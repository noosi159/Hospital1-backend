import pool from "../db/pool.js";

export async function listCases({
  status = "ALL",
  dateFrom,
  dateTo,
  dateType = "DISCHARGE",
  availableForCoder = false,
  limit = 50,
  page = 1,
} = {}) {
  const where = ["c.is_active = 1"];
  const params = [];

  if (status !== "ALL") {
    where.push("c.status = ?");
    params.push(status);
  }

  if (availableForCoder) {
    where.push("c.coder_id IS NULL");
  }

  if (dateFrom && dateTo) {
    if (String(dateType || "").toUpperCase() === "ASSIGNED") {
      where.push("DATE(aa.assigned_at) BETWEEN ? AND ?");
    } else {
      where.push("DATE(c.discharge_datetime) BETWEEN ? AND ?");
    }
    params.push(dateFrom, dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (Number(page) - 1) * Number(limit);

  const [rows] = await pool.query(
    `
    SELECT
      c.id,
      c.an,
      c.patient_name,
      c.right_name,
      c.status,
      c.discharge_datetime,

      au.full_name AS auditorName,
      cu.full_name AS coderName,

      aa.assigned_at AS assignedAt,
      aa.due_date AS dueAt

    FROM cases c
    LEFT JOIN users au ON au.id = c.auditor_id
    LEFT JOIN users cu ON cu.id = c.coder_id
    LEFT JOIN case_assignments aa
      ON aa.case_id = c.id
     AND aa.role = 'AUDITOR'
     AND aa.is_active = 1

    ${whereSql}
    ORDER BY c.discharge_datetime DESC
    LIMIT ? OFFSET ?
    `,
    [...params, Number(limit), offset]
  );

  const [[countRow]] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM cases c
    LEFT JOIN case_assignments aa
      ON aa.case_id = c.id
     AND aa.role = 'AUDITOR'
     AND aa.is_active = 1
    ${whereSql}
    `,
    params
  );

  return {
    rows,
    total: countRow.total,
  };
}

export async function getCaseById(caseId) {
  const [rows] = await pool.query(
    `SELECT * FROM cases WHERE id = ? LIMIT 1`,
    [caseId]
  );
  return rows[0] || null;
}

export async function countByStatus() {
  const [rows] = await pool.query(`
    SELECT c.status, COUNT(*) AS count
    FROM cases c
    WHERE c.is_active = 1
    GROUP BY c.status
  `);
  return rows;
}

export async function assignCase({
  caseId,
  role,
  assignedTo,
  assignedBy,
  dueDate,
}) {
  if (!caseId || !role || !assignedTo) {
    const err = new Error("Missing required fields: caseId, role, assignedTo");
    err.status = 400;
    throw err;
  }

  if (!["AUDITOR", "CODER"].includes(role)) {
    const err = new Error("Invalid role");
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[c]] = await conn.query(
      `SELECT id, is_active FROM cases WHERE id = ? LIMIT 1`,
      [caseId]
    );
    if (!c) {
      const err = new Error("Case not found");
      err.status = 404;
      throw err;
    }
    if (c.is_active === 0) {
      const err = new Error("Case is inactive");
      err.status = 400;
      throw err;
    }

    // ปิด assignment เดิมของ role นั้น
    await conn.query(
      `
      UPDATE case_assignments
      SET is_active = 0
      WHERE case_id = ?
        AND role = ?
        AND is_active = 1
      `,
      [caseId, role]
    );

    // สร้าง assignment ใหม่
    await conn.query(
      `
      INSERT INTO case_assignments
        (case_id, role, assigned_to, assigned_by, due_date)
      VALUES (?, ?, ?, ?, ?)
      `,
      [caseId, role, assignedTo, assignedBy || null, dueDate || null]
    );

    // อัปเดต cases + status
    if (role === "AUDITOR") {
      await conn.query(
        `
        UPDATE cases
        SET auditor_id = ?, status = 'ASSIGNED_AUDITOR', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [assignedTo, caseId]
      );
    } else {
      await conn.query(
        `
        UPDATE cases
        SET coder_id = ?, status = 'CODER_WORKING', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [assignedTo, caseId]
      );
    }

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function unassignCase({ caseId, role }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE case_assignments
      SET is_active = 0
      WHERE case_id = ? AND role = ? AND is_active = 1
      `,
      [caseId, role]
    );

    if (role === "AUDITOR") {
      await conn.query(
        `
        UPDATE cases
        SET auditor_id = NULL, status = 'NEW', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [caseId]
      );
    }

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
