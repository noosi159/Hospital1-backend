import pool from "../db/pool.js";

const normNum = (v) => {
  if (v === "" || v === undefined) return null;
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function upsertCaseRw({ caseId, rw, adjrw, calcNote = null, userId = null }) {
  const rwN = normNum(rw);
  const adjrwN = normNum(adjrw);

  await pool.query(
    `
    INSERT INTO case_rw (case_id, rw, adjrw, updated_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      rw = VALUES(rw),
      adjrw = VALUES(adjrw),
      updated_by = VALUES(updated_by),
      updated_at = NOW()
    `,
    [caseId, rwN, adjrwN, userId]
  );

  return { ok: true, caseId, rw: rwN, adjrw: adjrwN };
}
