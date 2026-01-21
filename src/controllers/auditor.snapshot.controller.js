import pool from "../db/pool.js";
import { createSnapshot } from "../services/snapshot.service.js";

async function updateCaseStatus(caseId, status) {
  await pool.query(`UPDATE cases SET status=?, updated_at=NOW() WHERE id=?`, [status, caseId]);
}

export async function saveDraft(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    await createSnapshot({ caseId, role: "AUDITOR", action: "SAVE", payload });
    await updateCaseStatus(caseId, "AUDITING");

    res.json({ ok: true, status: "AUDITING" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function exportToCoder(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

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
