import { getCurrentPreAdjRw, saveAdjRwWithHistory } from "../services/rw.service.js";

export async function getCurrentAdjrw(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "Invalid caseId" });

    const row = await getCurrentPreAdjRw(caseId);
    res.json(row);
  } catch (e) {
    next(e);
  }
}

export async function saveAdjrw(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "Invalid caseId" });

    const postAdjrw = req.body?.postAdjrw ?? req.body?.adjrw;
    const rw = req.body?.rw;
    const userId = Number(req.body?.coderId || 0) || null;

    const result = await saveAdjRwWithHistory({
      caseId,
      postAdjrw,
      rw,
      userId,
      source: "CODER_FORM",
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
}
