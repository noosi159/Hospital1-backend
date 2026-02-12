import pool from "../db/pool.js";
import { createSnapshot, getLatestSnapshot } from "../services/snapshot.service.js";
import { replaceDiagnosesByCase } from "../services/auditor.service.js";
import { deleteAuditorDraft, deleteCoderDraft } from "../services/draft.services.js";
import { getLatestAdjrwState, saveAdjRwWithHistory } from "../services/rw.service.js";

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function extractAdjrwValue(rawAdjrw) {
  if (rawAdjrw && typeof rawAdjrw === "object") {
    const candidates = [
      rawAdjrw.postAdjRw,
      rawAdjrw.postAdjrw,
      rawAdjrw.adjrw,
      rawAdjrw.value,
    ];
    for (const c of candidates) {
      const n = toNumberOrNull(c);
      if (n !== null) return n;
    }
    return null;
  }

  return toNumberOrNull(rawAdjrw);
}

async function persistPayload(caseId, payload = {}) {
  let adjrwResult = null;

  const rows = Array.isArray(payload?.diagnoses) ? payload.diagnoses : [];
  if (rows.length) {
    await replaceDiagnosesByCase(caseId, rows);
  }

  const postAdjrw = extractAdjrwValue(payload?.coder?.adjrw);
  if (postAdjrw !== null) {
    const rwInput = payload?.coder?.rw;
    const rwForSave = rwInput === "" || rwInput === null || rwInput === undefined
      ? undefined
      : rwInput;

    adjrwResult = await saveAdjRwWithHistory({
      caseId,
      rw: rwForSave,
      postAdjrw,
      userId: payload.coder?.updatedBy ?? null,
      source: "CODER_EXPORT",
    });
  }

  return { adjrw: adjrwResult };
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
    try {
      await conn.rollback();
    } catch {}
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

    const persistResult = await persistPayload(caseId, payload);

    const adj = persistResult?.adjrw || (await getLatestAdjrwState(caseId));
    const safeRw = toNumberOrNull(adj?.rw) ?? 0;
    const safePreAdjrw = toNumberOrNull(adj?.preAdjrw) ?? 0;
    const safePostAdjrw = toNumberOrNull(adj?.postAdjrw) ?? safePreAdjrw;

    const amountText =
      adj?.calculatedAmount != null
        ? Number(adj.calculatedAmount).toLocaleString("th-TH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null;

    const snapshotPayload = {
      ...payload,
      coder: {
        ...(payload?.coder || {}),
        rw: toNumberOrNull(payload?.coder?.rw) ?? safeRw,
        adjrw: toNumberOrNull(payload?.coder?.adjrw) ?? safePostAdjrw,
        preAdjRw: safePreAdjrw,
        postAdjRw: safePostAdjrw,
        calcType: payload?.coder?.calcType ?? (adj?.calculatedAmount == null ? "ACTUAL" : "RATE"),
        amountText: payload?.coder?.amountText ?? amountText,
      },
      adjrw: {
        rw: safeRw,
        preAdjrw: safePreAdjrw,
        postAdjrw: safePostAdjrw,
        rateYear: adj?.rateYear ?? null,
        rateUsed: adj?.rateUsed ?? null,
        calculatedAmount: adj?.calculatedAmount ?? null,
      },
    };

    await createSnapshot({
      caseId,
      role: "CODER",
      action: "SUBMIT_TO_AUDITOR",
      payload: snapshotPayload,
    });

    await pool.query(
      `UPDATE cases SET status='CODER_SENT', updated_at=NOW() WHERE id=?`,
      [caseId]
    );

    await deleteCoderDraft(caseId);
    await deleteAuditorDraft(caseId);

    res.json({ ok: true, status: "CODER_SENT", ...persistResult });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
