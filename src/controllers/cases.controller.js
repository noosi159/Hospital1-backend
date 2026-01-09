import * as service from "../services/case.service.js";

export async function list(req, res) {
  try {
    const status = (req.query.status || "ALL").toString().trim();
    const rows = await service.listCases({ status });
    return res.json(rows);
  } catch (err) {
    console.error("list error:", err);
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
    return res.status(status).json({ message: err.message || "Assign failed" });
  }
}
