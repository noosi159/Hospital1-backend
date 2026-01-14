import { listCasesForCoder, acceptCaseByCoder } from "../services/coder.service.js";

export async function listAllCases(req, res, next) {
  try {
    const rows = await listCasesForCoder();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function acceptCase(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);

    const coderId = Number(req.body.coderId);

    const r = await acceptCaseByCoder({ caseId, coderId });
    res.json(r);
  } catch (e) {
    next(e);
  }
}
