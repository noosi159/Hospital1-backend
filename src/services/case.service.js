import pool from "../db/pool.js";

/**
 * GET cases with status filter
 * - status = "ALL" => return all statuses
 * - status = "NEW" | "RETURNED" | "ASSIGNED_AUDITOR" | "CONFIRMED" => filter by that status
 */
export async function listCases({ status = "ALL" } = {}) {
  const where = [];
  const params = [];

  if (status && status !== "ALL") {
    where.push("c.status = ?");
    params.push(status);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
    SELECT
      c.id AS caseId,
      c.an,
      c.hn,
      c.patient_name AS patientName,

      c.department_id AS departmentId,
      d.name_th AS departmentNameTh,

      c.status,
      c.is_active AS isActive,

      c.auditor_id AS auditorId,
      au.full_name AS auditorName,
      c.coder_id AS coderId,
      cu.full_name AS coderName,

      ca.assigned_at AS assignedAt,
      c.received_date AS receivedAt,
      c.dc_date AS dueAt,

      c.note
    FROM cases c
    LEFT JOIN departments d ON d.id = c.department_id
    LEFT JOIN users au ON au.id = c.auditor_id
    LEFT JOIN users cu ON cu.id = c.coder_id

    LEFT JOIN (
      SELECT x.case_id, x.assigned_at, x.auditor_id, x.assigned_by
      FROM case_assignments x
      INNER JOIN (
        SELECT case_id, MAX(assigned_at) AS max_assigned_at
        FROM case_assignments
        GROUP BY case_id
      ) m ON m.case_id = x.case_id AND m.max_assigned_at = x.assigned_at
    ) ca ON ca.case_id = c.id

    ${whereSql}
    ORDER BY c.created_at DESC
    `,
    params
  );

  return rows;
}

/**
 * (Optional) Count for tab badges
 * returns: [{ status: 'NEW', count: 10 }, ...]
 */
export async function countByStatus() {
  const [rows] = await pool.query(`
    SELECT status, COUNT(*) AS count
    FROM cases
    GROUP BY status
  `);
  return rows;
}

export async function assignCase({ an, auditorId, assignedAt, dueAt, assignedBy }) {
  if (!an || !auditorId || !assignedAt || !dueAt) {
    const err = new Error("Missing required fields: an, auditorId, assignedAt, dueAt");
    err.status = 400;
    throw err;
  }

  const assignerId = Number(assignedBy) || 1;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[c]] = await conn.query(
      `SELECT id, status, is_active FROM cases WHERE an = ? LIMIT 1`,
      [an]
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

    const [[u]] = await conn.query(
      `SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [auditorId]
    );
    if (!u) {
      const err = new Error("Auditor not found");
      err.status = 404;
      throw err;
    }
    if (u.is_active === 0) {
      const err = new Error("Auditor is inactive");
      err.status = 400;
      throw err;
    }
    if (u.role !== "AUDITOR") {
      const err = new Error("Selected user is not an AUDITOR");
      err.status = 400;
      throw err;
    }

    // ✅ update cases
    await conn.query(
      `
      UPDATE cases
      SET
        auditor_id = ?,
        status = 'ASSIGNED_AUDITOR',
        received_date = COALESCE(received_date, ?),
        dc_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [auditorId, assignedAt, dueAt, c.id]
    );

    // ✅ insert history (assigned_by NOT NULL)
    await conn.query(
      `
      INSERT INTO case_assignments (case_id, assigned_at, auditor_id, assigned_by)
      VALUES (?, ?, ?, ?)
      `,
      [c.id, assignedAt, auditorId, assignerId]
    );

    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
