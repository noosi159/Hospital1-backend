
import pool from "../db/pool.js";
import { createSnapshot } from "../services/snapshot.service.js";
import { upsertCaseInfo, replaceDiagnosesByCase } from "../services/auditor.service.js";
import { getLatestAdjrwState } from "../services/rw.service.js";
import { deleteCoderDraft } from "../services/draft.services.js"; 

async function updateCaseStatus(caseId, status) {
  await pool.query(`UPDATE cases SET status=?, updated_at=NOW() WHERE id=?`, [status, caseId]);
}

const norm = (v) => (v === "" ? null : v);
const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const extractAdjrwValue = (rawAdjrw) => {
  if (rawAdjrw && typeof rawAdjrw === "object") {
    const candidates = [
      rawAdjrw.postAdjRw,
      rawAdjrw.postAdjrw,
      rawAdjrw.adjrw,
      rawAdjrw.value,
    ];
    for (const c of candidates) {
      const n = toNumberOrNull(c);
      if (n !== null) return n;
    }
    return null;
  }
  return toNumberOrNull(rawAdjrw);
};

function buildSnapshotPayloadWithAdjrw(payload, adjrwState) {
  const incomingCoder = payload?.coder && typeof payload.coder === "object" ? payload.coder : {};

  const incomingRw = toNumberOrNull(incomingCoder.rw);
  const incomingAdjrw =
    extractAdjrwValue(incomingCoder.adjrw) ??
    toNumberOrNull(incomingCoder.postAdjRw) ??
    toNumberOrNull(incomingCoder.postAdjrw);

  const safeRw = toNumberOrNull(adjrwState?.rw);
  const safePreAdjrw = toNumberOrNull(adjrwState?.preAdjrw) ?? 0;
  const safePostAdjrw = toNumberOrNull(adjrwState?.postAdjrw) ?? safePreAdjrw;

  return {
    ...(payload || {}),
    coder: {
      ...incomingCoder,
      rw: incomingRw ?? safeRw ?? null,
      adjrw: incomingAdjrw ?? safePostAdjrw,
      preAdjRw: incomingCoder.preAdjRw ?? safePreAdjrw,
      postAdjRw: incomingCoder.postAdjRw ?? safePostAdjrw,
    },
  };
}

async function persistPayload(caseId, payload = {}) {
  const ci = payload?.caseInfo || {};
  await upsertCaseInfo(caseId, {
    sex: ci.sex !== undefined ? norm(ci.sex) : undefined,
    age: ci.age !== undefined ? norm(ci.age) : undefined,
    ward: ci.ward !== undefined ? norm(ci.ward) : undefined,
    coverage: ci.coverage !== undefined ? norm(ci.coverage) : undefined,
    coverage_code: ci.coverage_code !== undefined ? norm(ci.coverage_code) : undefined,
  });

  const rows = Array.isArray(payload?.diagnoses) ? payload.diagnoses : [];
  await replaceDiagnosesByCase(caseId, rows);
}

export async function exportToCoder(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    const payload = req.body || {};

    await persistPayload(caseId, payload);
    const adjrwState = await getLatestAdjrwState(caseId);
    const snapshotPayload = buildSnapshotPayloadWithAdjrw(payload, adjrwState);

    await createSnapshot({ caseId, role: "AUDITOR", action: "SUBMIT_TO_CODER", payload: snapshotPayload });
    await updateCaseStatus(caseId, "SENT_TO_CODER");

    // ✅ Step 5: ล้าง draft ของ Coder (ผู้รับ) กัน draft เก่าไปทับ snapshot ใหม่
    await deleteCoderDraft(caseId);

    res.json({ ok: true, status: "SENT_TO_CODER" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

export async function confirmCase(req, res) {
  try {
    const caseId = Number(req.params.caseId);
    await updateCaseStatus(caseId, "CONFIRMED");
    res.json({ ok: true, status: "CONFIRMED" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}
