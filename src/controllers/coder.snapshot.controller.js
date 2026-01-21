import pool from "../db/pool.js";
import { createSnapshot, getLatestSnapshot } from "../services/snapshot.service.js";

// 5.1 list available cases (ยังไม่มี coder_id) และต้อง SENT_TO_CODER เท่านั้น
export async function listAvailable(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT c.id AS caseId, c.an, c.hn, c.patient_name AS patientName, c.status,
              c.auditor_id AS auditorId, c.coder_id AS coderId,
              c.updated_at AS updatedAt
       FROM cases c
       WHERE c.is_active=1 AND c.status='SENT_TO_CODER' AND c.coder_id IS NULL
       ORDER BY c.updated_at DESC`
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

// 5.2 claim case (atomic)
export async function claimCase(req, res) {
  const conn = await pool.getConnection();
  try {
    const caseId = Number(req.params.caseId);
    const coderId = Number(req.body?.coderId); // คุณจะเปลี่ยนไปใช้ auth token ก็ได้

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

// 5.3 load form for coder: อ่าน snapshot ล่าสุด AUDITOR/SUBMIT_TO_CODER เท่านั้น
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

// 5.4 coder save draft -> CODER_WORKING
export async function saveDraft(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

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

    await createSnapshot({ caseId, role: "CODER", action: "SUBMIT_TO_AUDITOR", payload });
    await pool.query(`UPDATE cases SET status='CODER_SENT', updated_at=NOW() WHERE id=?`, [caseId]);

    res.json({ ok: true, status: "CODER_SENT" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
