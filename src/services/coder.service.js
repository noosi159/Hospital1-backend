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

      c.auditor_id AS auditorId,
      au.full_name AS auditorName,

      c.coder_id AS coderId,
      cu.full_name AS coderName,

      c.created_at AS receivedAt,
      c.updated_at AS sentAt,
      c.note

    FROM cases c
    LEFT JOIN users au ON au.id = c.auditor_id
    LEFT JOIN users cu ON cu.id = c.coder_id
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

    // ตรวจว่า user เป็น coder
    const [[u]] = await conn.query(
      `SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1`,
      [coderId]
    );
    if (!u || u.is_active === 0 || u.role !== "CODER") {
      const err = new Error("Invalid coder");
      err.status = 400;
      throw err;
    }

    // ✅ ไม่เปลี่ยน status (ตาม requirement ของคุณ)
    await conn.query(
      `
      UPDATE cases
      SET coder_id = ?, status = 'CODER_WORKING', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND coder_id IS NULL
      `,
      [coderId, caseId]
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
export function loadCoderForm(caseId) {
  return apiFetch(`/api/coder/cases/${caseId}/form`);
}

export function coderSaveDraft(caseId, payload) {
  return apiFetch(`/api/coder/cases/${caseId}/draft`, {
    method: "POST",
    body: payload,
  });
}

export function coderExportToAuditor(caseId, payload) {
  return apiFetch(`/api/coder/cases/${caseId}/export-to-auditor`, {
    method: "POST",
    body: payload,
  });
}
