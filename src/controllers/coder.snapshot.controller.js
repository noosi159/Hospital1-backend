import pool from "../db/pool.js";
import { createSnapshot, getLatestSnapshot } from "../services/snapshot.service.js";
import { replaceDiagnosesByCase } from "../services/auditor.service.js";
import { deleteAuditorDraft, deleteCoderDraft } from "../services/draft.services.js";
import { upsertCaseRw } from "../services/rw.service.js";

const norm = (v) => (v === "" ? null : v);


async function persistPayload(caseId, payload = {}) {
  // 1) diagnoses
  const rows = Array.isArray(payload?.diagnoses) ? payload.diagnoses : [];
  if (rows.length) {
    await replaceDiagnosesByCase(caseId, rows);
  }

  // 2) RW / AdjRW
  if (payload?.coder) {
    await upsertCaseRw({
      caseId,
      rw: payload.coder?.rw,
      adjrw: payload.coder?.adjrw,
      calcNote: payload.coder?.rwNote ?? payload.coder?.remark ?? null,
      userId: payload.coder?.updatedBy ?? null,
    });
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

export async function exportToAuditor(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    //บันทึก payload ลงตารางจริงก่อน (รวม RW/AdjRW)
    await persistPayload(caseId, payload);

    //สร้าง snapshot ส่งให้ออดิเตอร์
    await createSnapshot({ caseId, role: "CODER", action: "SUBMIT_TO_AUDITOR", payload });

    //อัปเดตสถานะ
    await pool.query(
      `UPDATE cases SET status='CODER_SENT', updated_at=NOW() WHERE id=?`,
      [caseId]
    );

    // ลบ draft ทั้งสองฝั่ง เพื่อไม่ให้ Auditor เห็นข้อมูลเก่าจาก draft overlay
    await deleteCoderDraft(caseId);
    await deleteAuditorDraft(caseId);

    res.json({ ok: true, status: "CODER_SENT" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
