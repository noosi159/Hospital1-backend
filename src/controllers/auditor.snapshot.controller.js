import pool from "../db/pool.js";
import { createSnapshot } from "../services/snapshot.service.js";
import { upsertCaseInfo, replaceDiagnosesByCase } from "../services/auditor.service.js";

async function updateCaseStatus(caseId, status) {
  await pool.query(`UPDATE cases SET status=?, updated_at=NOW() WHERE id=?`, [status, caseId]);
}

const norm = (v) => (v === "" ? null : v);

async function persistPayload(caseId, payload = {}) {
  const ci = payload?.caseInfo || {};

  const [[cur]] = await pool.query(
    `SELECT sex, age, ward, coverage FROM case_info WHERE case_id=? LIMIT 1`,
    [caseId]
  );

  const merged = {
    sex: ci.sex !== undefined ? norm(ci.sex) : cur?.sex ?? null,
    age: ci.age !== undefined ? norm(ci.age) : cur?.age ?? null,
    ward: ci.ward !== undefined ? norm(ci.ward) : cur?.ward ?? null,
    coverage: ci.coverage !== undefined ? norm(ci.coverage) : cur?.coverage ?? null,
  };

  await upsertCaseInfo(caseId, merged);

  const rows = Array.isArray(payload?.diagnoses) ? payload.diagnoses : [];
  await replaceDiagnosesByCase(caseId, rows);
}


export async function exportToCoder(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    await persistPayload(caseId, payload);
    await createSnapshot({ caseId, role: "AUDITOR", action: "SUBMIT_TO_CODER", payload });
    await updateCaseStatus(caseId, "SENT_TO_CODER");

    res.json({ ok: true, status: "SENT_TO_CODER" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function confirmCase(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    await updateCaseStatus(caseId, "CONFIRMED");
    res.json({ ok: true, status: "CONFIRMED" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
