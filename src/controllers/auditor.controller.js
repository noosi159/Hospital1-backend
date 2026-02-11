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
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const offset = (page - 1) * limit;
    const dateType = String(req.query.dateType || "ASSIGNED").toUpperCase();
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : "";
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : "";

    const ALLOWED = [
      "ASSIGNED_AUDITOR",
      "AUDITING",
      "SENT_TO_CODER",
      "CODER_WORKING",
      "CODER_SENT",
      "RETURNED",
      "CONFIRMED",
    ];

    const statusRaw = String(req.query.status || "ALL").trim();
    let statuses = [];
    if (statusRaw !== "ALL") {
      statuses = statusRaw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => ALLOWED.includes(s));
      if (!statuses.length) {
        return res.json({ rows: [], total: 0, page, limit, totalPages: 1 });
      }
    } else {
      statuses = ALLOWED;
    }

    const whereStatus = ` AND c.status IN (${statuses.map(() => "?").join(",")}) `;
    const baseParams = [auditorId, ...statuses];
    const dateParams = [];

    let whereDate = "";
    if (dateFrom && dateTo) {
      const dateCol = dateType === "DISCHARGE" ? "c.discharge_datetime" : "c.updated_at";
      whereDate = ` AND DATE(${dateCol}) BETWEEN ? AND ? `;
      dateParams.push(dateFrom, dateTo);
    }

    const [rows] = await pool.query(
      `
      SELECT
        c.id AS caseId,
        c.an,
        c.hn,
        c.patient_name AS patientName,
        c.ward_name AS department,       
        c.status,
        c.note,
        c.created_at AS receivedAt,
        c.updated_at AS assignedAt,
        c.updated_at AS updatedAt,
        c.discharge_datetime AS dischargeDatetime,
        c.right_name AS rightName
      FROM cases c
      WHERE c.is_active = 1
        AND c.auditor_id = ?
        ${whereStatus}
        ${whereDate}
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
      `,
      [...baseParams, ...dateParams, limit, offset]
    );

    const [[countRow]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM cases c
      WHERE c.is_active = 1
        AND c.auditor_id = ?
        ${whereStatus}
        ${whereDate}
      `,
      [...baseParams, ...dateParams]
    );

    const total = Number(countRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.json({ rows, total, page, limit, totalPages });
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

    const data = await upsertCaseInfoService(caseId, req.body || {});
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


