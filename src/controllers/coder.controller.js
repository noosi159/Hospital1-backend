import { listCasesForCoder, acceptCaseByCoder } from "../services/coder.service.js";
import pool from "../db/pool.js";

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

export async function confirmCase(req, res, next) {
  try {
    const caseId = Number(req.params.caseId);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ message: "Invalid caseId" });
    }

    const [result] = await pool.query(
      `UPDATE cases SET status='CONFIRMED', updated_at=NOW() WHERE id=?`,
      [caseId]
    );

    if (!result?.affectedRows) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json({ ok: true, status: "CONFIRMED" });
  } catch (e) {
    next(e);
  }
}
