import pool from "../db/pool.js";
import { createSnapshot, getLatestSnapshot } from "../services/snapshot.service.js";
import { upsertCaseInfo, replaceDiagnosesByCase } from "../services/auditor.service.js";

const norm = (v) => (v === "" ? null : v);

async function persistPayload(caseId, payload = {}) {
  const ci = payload?.caseInfo || {};

  if (payload?.caseInfo) {
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
  }

  const rows = Array.isArray(payload?.diagnoses) ? payload.diagnoses : [];
  if (rows.length) {
    await replaceDiagnosesByCase(caseId, rows);
  }
}

export async function claimCase(req, res) {
  const conn = await pool.getConnection();
  try {
    const caseId = Number(req.params.caseId);
    const coderId = Number(req.body?.coderId);
    if (!coderId) return res.status(400).json({ message: "coderId is required" });

    await conn.beginTransaction();

    const [[c]] = await conn.query(
      `SELECT id, status, coder_id FROM cases WHERE id=? FOR UPDATE`,
      [caseId]
    );

    if (!c) {
      await conn.rollback();
      return res.status(404).json({ message: "Case not found" });
    }

    if (c.status !== "SENT_TO_CODER") {
      await conn.rollback();
      return res.status(409).json({ message: "Case must be SENT_TO_CODER to claim" });
    }

    if (c.coder_id) {
      await conn.rollback();
      return res.status(409).json({ message: "Case already claimed by another coder" });
    }

    await conn.query(
      `UPDATE cases
       SET coder_id=?, coder_claimed_at=NOW(), updated_at=NOW()
       WHERE id=? AND coder_id IS NULL`,
      [coderId, caseId]
    );

    await conn.commit();
    res.json({ ok: true, caseId, coderId });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    res.status(500).json({ message: e.message });
  } finally {
    conn.release();
  }
}

export async function loadForm(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const snap = await getLatestSnapshot({ caseId, role: "AUDITOR", action: "SUBMIT_TO_CODER" });
    if (!snap) return res.status(404).json({ message: "No auditor export found" });
    res.json(snap);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function saveDraft(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    await persistPayload(caseId, payload);
    await createSnapshot({ caseId, role: "CODER", action: "SAVE", payload });
    await pool.query(`UPDATE cases SET status='CODER_WORKING', updated_at=NOW() WHERE id=?`, [caseId]);

    res.json({ ok: true, status: "CODER_WORKING" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function exportToAuditor(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    await persistPayload(caseId, payload);
    await createSnapshot({ caseId, role: "CODER", action: "SUBMIT_TO_AUDITOR", payload });
    await pool.query(`UPDATE cases SET status='CODER_SENT', updated_at=NOW() WHERE id=?`, [caseId]);

    res.json({ ok: true, status: "CODER_SENT" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
