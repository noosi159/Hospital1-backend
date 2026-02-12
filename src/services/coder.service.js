import pool from "../db/pool.js";

export async function listCasesForCoder() {
  const [rows] = await pool.query(`
    SELECT
      c.id AS caseId,
      c.an,
      c.hn,
      c.patient_name AS patientName,
      c.ward_name AS departmentNameTh,
      c.status,
      c.is_active AS isActive,
      c.discharge_datetime AS dischargeAt,

      c.auditor_id AS auditorId,
      au.full_name AS auditorName,

      c.coder_id AS coderId,
      cu.full_name AS coderName,

      c.created_at AS receivedAt,
      c.updated_at AS sentAt,
      aa.assigned_at AS assignedAt,
      aa.due_date AS dueAt,
      c.note

    FROM cases c
    LEFT JOIN users au ON au.id = c.auditor_id
    LEFT JOIN users cu ON cu.id = c.coder_id
    LEFT JOIN (
      SELECT ca.case_id, ca.assigned_at, ca.due_date
      FROM case_assignments ca
      INNER JOIN (
        SELECT case_id, MAX(id) AS max_id
        FROM case_assignments
        WHERE role = 'AUDITOR'
        GROUP BY case_id
      ) latest ON latest.max_id = ca.id
    ) aa ON aa.case_id = c.id
    WHERE c.is_active = 1
    ORDER BY c.created_at DESC
  `);

  return rows;
}

export async function acceptCaseByCoder({ caseId, coderId }) {
  if (!caseId || !coderId) {
    const err = new Error("Missing required fields: caseId, coderId");
    err.status = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[c]] = await conn.query(
      `SELECT id, coder_id, is_active FROM cases WHERE id = ? FOR UPDATE`,
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
    if (c.coder_id) {
      const err = new Error("Case already taken");
      err.status = 409;
      throw err;
    }

    const [[u]] = await conn.query(
      `SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [coderId]
    );
    if (!u || u.is_active === 0 || u.role !== "CODER") {
      const err = new Error("Invalid coder");
      err.status = 400;
      throw err;
    }

    const [updateResult] = await conn.query(
      `
      UPDATE cases
      SET coder_id = ?, status = 'CODER_WORKING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND (coder_id IS NULL OR coder_id = 0)
      `,
      [coderId, caseId]
    );

    if (!updateResult?.affectedRows) {
      const err = new Error("Case already taken");
      err.status = 409;
      throw err;
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
