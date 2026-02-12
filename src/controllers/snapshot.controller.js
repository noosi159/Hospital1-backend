import {
  getSnapshotPayloadById,
  listCaseSnapshotHistory,
} from "../services/snapshot.service.js";

export async function listCaseSnapshots(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    if (!Number.isFinite(caseId)) {
      return res.status(400).json({ message: "Invalid caseId" });
    }
    const rows = await listCaseSnapshotHistory(caseId);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function readSnapshot(req, res) {
  try {
    const snapshotId = Number(req.params.id);
    if (!Number.isFinite(snapshotId)) {
      return res.status(400).json({ message: "Invalid snapshot id" });
    }
    const snap = await getSnapshotPayloadById(snapshotId);
    if (!snap) return res.status(404).json({ message: "Snapshot not found" });

    let payloadJson = snap.payload_json ?? null;
    if (Buffer.isBuffer(payloadJson)) {
      payloadJson = payloadJson.toString("utf8");
    }
    if (typeof payloadJson === "string") {
      try {
        payloadJson = JSON.parse(payloadJson);
      } catch {
        // keep as raw string if JSON parse fails
      }
    }
    res.json({ payload_json: payloadJson });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
