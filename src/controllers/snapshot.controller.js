import { getSnapshotById, listSnapshots } from "../services/snapshot.service.js";

export async function listCaseSnapshots(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const role = req.query.role || null;
    const action = req.query.action || null;
    const limit = req.query.limit || 200;

    const rows = await listSnapshots({ caseId, role, action, limit });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function readSnapshot(req, res) {
  try {
    const snapshotId = Number(req.params.snapshotId);
    const snap = await getSnapshotById(snapshotId);
    if (!snap) return res.status(404).json({ message: "Snapshot not found" });
    res.json(snap);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
