import pool from "../db/pool.js";

export async function getAuditorDraft(caseId) {
  const [[row]] = await pool.query(
    `SELECT case_id, auditor_id, payload_json, version, updated_at
     FROM auditor_drafts
     WHERE case_id = ?
     LIMIT 1`,
    [caseId]
  );
  return row || null;
}

export async function upsertAuditorDraft(caseId, auditorId, payload) {
  await pool.query(
    `INSERT INTO auditor_drafts (case_id, auditor_id, payload_json, version)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       auditor_id = VALUES(auditor_id),
       payload_json = VALUES(payload_json),
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [caseId, auditorId ?? null, JSON.stringify(payload ?? {})]
  );

  return getAuditorDraft(caseId);
}

export async function deleteAuditorDraft(caseId) {
  await pool.query(`DELETE FROM auditor_drafts WHERE case_id=?`, [caseId]);
  return { ok: true };
}


export async function getCoderDraft(caseId) {
  const [[row]] = await pool.query(
    `SELECT case_id, coder_id, payload_json, version, updated_at
     FROM coder_drafts
     WHERE case_id = ?
     LIMIT 1`,
    [caseId]
  );
  return row || null;
}

export async function upsertCoderDraft(caseId, coderId, payload) {
  await pool.query(
    `INSERT INTO coder_drafts (case_id, coder_id, payload_json, version)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       coder_id = VALUES(coder_id),
       payload_json = VALUES(payload_json),
       version = version + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [caseId, coderId ?? null, JSON.stringify(payload ?? {})]
  );

  return getCoderDraft(caseId);
}

export async function deleteCoderDraft(caseId) {
  await pool.query(`DELETE FROM coder_drafts WHERE case_id=?`, [caseId]);
  return { ok: true };
}
