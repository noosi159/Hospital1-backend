import { getAuditorDraft, upsertAuditorDraft, deleteAuditorDraft } from "../services/draft.services.js";

export async function getDraft(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    const row = await getAuditorDraft(caseId);
    if (!row) return res.json(null);

    res.json({
      caseId: row.case_id,
      auditorId: row.auditor_id,
      payload: row.payload_json,
      version: row.version,
      updatedAt: row.updated_at,
    });
  } catch (e) { next(e); }
}

export async function saveDraft(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    const auditorId = Number(req.body?.auditorId || 0) || null;
    const payload = req.body?.payload ?? req.body ?? {};

    const row = await upsertAuditorDraft(caseId, auditorId, payload);

    res.json({
      ok: true,
      caseId: row.case_id,
      auditorId: row.auditor_id,
      payload: row.payload_json,
      version: row.version,
      updatedAt: row.updated_at,
    });
  } catch (e) { next(e); }
}

export async function clearDraft(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    const r = await deleteAuditorDraft(caseId);
    res.json(r);
  } catch (e) { next(e); }
}
