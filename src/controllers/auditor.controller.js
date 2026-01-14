import pool from "../db/pool.js";
import {
  returnAuditorCase,
  getCaseDetail as getCaseDetailService,
  listDiagnosesByCase,
  upsertCaseInfo as upsertCaseInfoService,
  replaceDiagnosesByCase,
  deleteDiagnosisById,
} from "../services/auditor.service.js";


export async function listMyCases(req, res) {
  try {
    const auditorId = Number(req.query.auditorId);
    if (!auditorId) return res.status(400).json({ message: "auditorId is required" });

    const [rows] = await pool.query(
      `
      SELECT
        c.id AS caseId,
        c.an, c.hn, c.patient_name AS patientName,
        d.name_th AS department,
        c.status,
        c.note,
        c.updated_at AS assignedAt
      FROM cases c
      LEFT JOIN departments d ON d.id = c.department_id
      WHERE c.is_active = 1
        AND c.auditor_id = ?
        AND c.status IN ('ASSIGNED_AUDITOR','AUDITING')
      ORDER BY c.updated_at DESC
      `,
      [auditorId]
    );

    return res.json(rows);
  } catch (err) {
    console.error("listMyCases error:", err);
    return res.status(500).json({ message: err.message });
  }
}


export async function returnCase(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const userId = req.user?.id || null;
    const result = await returnAuditorCase(caseId, userId);

    return res.json({ message: "Returned", ...result });
  } catch (err) {
    console.error("returnCase error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function getCaseDetail(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const data = await getCaseDetailService(caseId);
    return res.json(data);
  } catch (err) {
    console.error("getCaseDetail error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}



export async function listDiagnoses(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const rows = await listDiagnosesByCase(caseId);
    return res.json(rows);
  } catch (err) {
    console.error("listDiagnoses error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}


export async function upsertCaseInfo(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const data = await upsertCaseInfo(caseId, req.body || {});
    return res.json({ message: "OK", data });
  } catch (err) {
    console.error("upsertCaseInfo error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function replaceDiagnoses(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!caseId) return res.status(400).json({ message: "caseId is required" });

    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const data = await replaceDiagnosesByCase(caseId, rows);
    return res.json({ message: "OK", data });
  } catch (err) {
    console.error("replaceDiagnoses error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function deleteDiagnosis(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "id is required" });

    const data = await deleteDiagnosisById(id);
    return res.json({ message: "OK", ...data });
  } catch (err) {
    console.error("deleteDiagnosis error:", err);
    return res.status(err.status || 500).json({ message: err.message });
  }
}


