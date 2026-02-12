import * as service from "../services/case.service.js";

export async function list(req, res) {
  try {
    const status = (req.query.status || "ALL").toString().trim();
    const limit = Number(req.query.limit || 50);
    const page = Number(req.query.page || 1);
    const dateFrom = req.query.dateFrom?.toString().trim();
    const dateTo = req.query.dateTo?.toString().trim();
    const dateType = req.query.dateType?.toString().trim();
    const availableForCoder =
      String(req.query.availableForCoder || "").toLowerCase() === "1" ||
      String(req.query.availableForCoder || "").toLowerCase() === "true";

    const data = await service.listCases({
      status,
      limit,
      page,
      dateFrom,
      dateTo,
      dateType,
      availableForCoder,
    });
    return res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
}

export async function getById(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ message: "Invalid caseId" });
    }

    const data = await service.getCaseById(caseId);
    if (!data) {
      return res.status(404).json({ message: "Case not found" });
    }
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
}


export async function assign(req, res) {
  try {
    await service.assignCase({
      ...req.body,
      assignedBy: 1,
    });
    return res.json({ message: "Assigned" });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    return res.status(status).json({
      message: err.message || "Assign failed",
    });
  }
}

export async function countCases(req, res) {
  try {
    const { status = "ALL" } = req.query;
    const total = await service.countCases({ status });
    res.json({ total });
  } catch (err) {
    console.error("countCases error:", err);
    res.status(500).json({ message: err.message });
  }
}

