import pool from "../db/pool.js";

/* ===============================
 * CONFIG
 * =============================== */
const HIS_BASE = process.env.HIS_BASE_URL || "";

/* ===============================
 * HELPERS
 * =============================== */
function safeParam(v) {
  const s = String(v ?? "").trim();
  return s ? s : "_";
}

function buildPatientsDischargeUrl({ hn, an, dc_since, dc_end }) {
  return (
    `${HIS_BASE}/PatientsDischarge/` +
    `${safeParam(hn)}/${safeParam(an)}/${safeParam(dc_since)}/${safeParam(dc_end)}`
  );
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v?.data && Array.isArray(v.data)) return v.data;
  return [];
}

function parseHisDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseHisAmount(v) {
  if (v === null || v === undefined || v === "") return null;
  const cleaned = String(v)
    .replace(/[^0-9.\-]/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pickReceiveAmt(item) {
  return (
    item?.RECEIVE_AMT ??
    item?.RECEVIE_AMT ??
    item?.RECVIE_AMT ??
    item?.receive_amt ??
    item?.receiveAmt ??
    null
  );
}

/* ===============================
 * MAIN SYNC
 * =============================== */
export async function syncCasesFromHIS({ hn, an, dc_since, dc_end }) {
  if (!HIS_BASE) {
    throw new Error("HIS_BASE_URL is not set");
  }

  const url = buildPatientsDischargeUrl({ hn, an, dc_since, dc_end });
  console.log("🔗 HIS URL:", url);

  const r = await fetch(url);
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HIS error ${r.status}: ${text}`);
  }

  const data = await r.json();
  const rows = toArray(data);
  const [receiveAmtCols] = await pool.query(`SHOW COLUMNS FROM cases LIKE 'receive_amt'`);
  const hasReceiveAmt = Array.isArray(receiveAmtCols) && receiveAmtCols.length > 0;

  let upserted = 0;

  for (const it of rows) {
    const HN = String(it?.HN ?? "").trim();
    const AN = String(it?.AN ?? "").trim();
    if (!HN || !AN) continue;

    const dischargedAt = parseHisDate(it?.DISCHARGEDATETIME);

    const receiveAmt = parseHisAmount(pickReceiveAmt(it));

    if (hasReceiveAmt) {
      await pool.query(
        `
        INSERT INTO cases (
          hn, an,
          patient_name,
          discharge_datetime,
          receive_amt,
          age_text,
          right_code, right_name,
          ward_code, ward_name,
          sex_code, sex_name,
          status,
          his_last_sync_at
        )
        VALUES (
          ?, ?,
          ?, ?,
          ?,
          ?,
          ?, ?,
          ?, ?,
          ?, ?,
          'NEW',
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          patient_name = VALUES(patient_name),
          discharge_datetime = VALUES(discharge_datetime),
          receive_amt = VALUES(receive_amt),
          age_text = VALUES(age_text),
          right_code = COALESCE(VALUES(right_code), right_code),
          right_name = COALESCE(VALUES(right_name), right_name),
          ward_code = VALUES(ward_code),
          ward_name = VALUES(ward_name),
          sex_code = VALUES(sex_code),
          sex_name = VALUES(sex_name),
          his_last_sync_at = NOW()
        `,
        [
          HN, AN,
          it?.PATIENTNAME ?? null,
          dischargedAt,
          receiveAmt,
          it?.AGE ?? null,
          it?.RIGHTCODE ?? null,
          it?.RIGHTNAME ?? null,
          it?.WARDCODE ?? null,
          it?.WARDNAME ?? null,
          it?.SEXCODE ?? null,
          it?.SEXNAME ?? null
        ]
      );
    } else {
      await pool.query(
        `
        INSERT INTO cases (
          hn, an,
          patient_name,
          discharge_datetime,
          age_text,
          right_code, right_name,
          ward_code, ward_name,
          sex_code, sex_name,
          status,
          his_last_sync_at
        )
        VALUES (
          ?, ?,
          ?, ?,
          ?,
          ?, ?,
          ?, ?,
          ?, ?,
          'NEW',
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          patient_name = VALUES(patient_name),
          discharge_datetime = VALUES(discharge_datetime),
          age_text = VALUES(age_text),
          right_code = COALESCE(VALUES(right_code), right_code),
          right_name = COALESCE(VALUES(right_name), right_name),
          ward_code = VALUES(ward_code),
          ward_name = VALUES(ward_name),
          sex_code = VALUES(sex_code),
          sex_name = VALUES(sex_name),
          his_last_sync_at = NOW()
        `,
        [
          HN, AN,
          it?.PATIENTNAME ?? null,
          dischargedAt,
          it?.AGE ?? null,
          it?.RIGHTCODE ?? null,
          it?.RIGHTNAME ?? null,
          it?.WARDCODE ?? null,
          it?.WARDNAME ?? null,
          it?.SEXCODE ?? null,
          it?.SEXNAME ?? null
        ]
      );
    }

    const [[c]] = await pool.query(
      `SELECT id FROM cases WHERE an = ? LIMIT 1`,
      [AN]
    );
    if (!c?.id) continue;

    await pool.query(
      `
      INSERT INTO case_his_payload (case_id, endpoint, payload)
      VALUES (?, 'PatientsDischarge', ?)
      `,
      [c.id, JSON.stringify(it)]
    );

    upserted++;
  }

  return {
    fetched: rows.length,
    upserted,
  };
}
