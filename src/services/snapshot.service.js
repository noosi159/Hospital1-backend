import pool from "../db/pool.js";

/**
 * payload_json ใช้ JSON string
 * role: "AUDITOR" | "CODER"
 * action: "SAVE" | "SUBMIT_TO_CODER" | "SUBMIT_TO_AUDITOR"
 */
export async function createSnapshot({ caseId, role, action, payload, createdBy = null }) {
  const json = JSON.stringify(payload ?? {});
  const [r] = await pool.query(
    `INSERT INTO case_form_snapshots (case_id, role, action, payload_json, created_by)
     VALUES (?, ?, ?, CAST(? AS JSON), ?)`,
    [caseId, role, action, json, createdBy]
  );
  return { id: r.insertId };
}

export async function listSnapshots({ caseId, role = null, action = null, limit = 200 }) {
  const params = [caseId];
  let where = `WHERE s.case_id=?`;
  if (role) {
    where += ` AND s.role=?`;
    params.push(role);
  }
  if (action) {
    where += ` AND s.action=?`;
    params.push(action);
  }

  const [rows] = await pool.query(
    `SELECT s.id, s.case_id AS caseId, s.role, s.action,
            s.created_by AS createdBy,
            s.created_at AS createdAt
     FROM case_form_snapshots s
     ${where}
     ORDER BY s.id DESC
     LIMIT ${Number(limit)}`,
    params
  );

  return rows;
}

export async function getSnapshotById(snapshotId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.case_id AS caseId, s.role, s.action,
            s.payload_json AS payload,
            s.created_by AS createdBy,
            s.created_at AS createdAt
     FROM case_form_snapshots s
     WHERE s.id=?
     LIMIT 1`,
    [snapshotId]
  );
  return rows[0] || null;
}

export async function getLatestSnapshot({ caseId, role, action }) {
  const [rows] = await pool.query(
    `SELECT s.id, s.case_id AS caseId, s.role, s.action,
            s.payload_json AS payload,
            s.created_by AS createdBy,
            s.created_at AS createdAt
     FROM case_form_snapshots s
     WHERE s.case_id=? AND s.role=? AND s.action=?
     ORDER BY s.id DESC
     LIMIT 1`,
    [caseId, role, action]
  );
  return rows[0] || null;
}
