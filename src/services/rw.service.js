import pool from "../db/pool.js";

const normNum = (v) => {
  if (v === "" || v === undefined) return null;
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const toFiniteOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function matchesAdjrw(row, adjrw) {
  const min = toFiniteOrNull(row?.adjrw_min);
  const max = toFiniteOrNull(row?.adjrw_max);
  const a = toFiniteOrNull(adjrw);
  if (a === null) return false;

  if (min === null && max !== null) return a < max;
  if (min !== null && max === null) return a >= min;
  if (min !== null && max !== null) return a >= min && a <= max;
  return true;
}

function compareMatchedRows(a, b) {
  const minA = toFiniteOrNull(a?.adjrw_min);
  const maxA = toFiniteOrNull(a?.adjrw_max);
  const minB = toFiniteOrNull(b?.adjrw_min);
  const maxB = toFiniteOrNull(b?.adjrw_max);

  const typeA = minA !== null && maxA !== null ? 3 : minA !== null ? 2 : maxA !== null ? 1 : 0;
  const typeB = minB !== null && maxB !== null ? 3 : minB !== null ? 2 : maxB !== null ? 1 : 0;
  if (typeB !== typeA) return typeB - typeA;

  if (typeA === 3) {
    const widthA = maxA - minA;
    const widthB = maxB - minB;
    if (widthA !== widthB) return widthA - widthB;
    if (minB !== minA) return minB - minA;
  } else if (typeA === 2) {
    if (minB !== minA) return minB - minA;
  } else if (typeA === 1) {
    if (maxA !== maxB) return maxA - maxB;
  }

  return Number(b?.id || 0) - Number(a?.id || 0);
}

async function findCoverageGroupByCase(conn, caseId) {
  const [[row]] = await conn.query(
    `
    SELECT m.coverage_group
    FROM cases c
    JOIN coverage_prefix_mapping m
      ON UPPER(TRIM(IFNULL(c.right_code, ''))) LIKE CONCAT(UPPER(TRIM(m.right_prefix)), '%')
    WHERE c.id = ?
    ORDER BY CHAR_LENGTH(m.right_prefix) DESC
    LIMIT 1
    `,
    [caseId]
  );

  return row?.coverage_group ? String(row.coverage_group).toUpperCase() : null;
}

async function pickRateForAdjrw(conn, { coverageGroup, rateYear, adjrw }) {
  if (!coverageGroup || !Number.isFinite(Number(rateYear)) || !Number.isFinite(Number(adjrw))) {
    return null;
  }

  const [rows] = await conn.query(
    `
    SELECT id, adjrw_min, adjrw_max, rate_per_adjrw, calc_type
    FROM coverage_rates
    WHERE coverage_group = ?
      AND rate_year = ?
    ORDER BY id DESC
    `,
    [coverageGroup, rateYear]
  );

  const matched = (rows || []).filter((r) => matchesAdjrw(r, adjrw)).sort(compareMatchedRows);
  return matched[0] || null;
}

async function resolveRateSnapshot(conn, { caseId, nextAdjrw, existingRateYear }) {
  if (existingRateYear !== null && existingRateYear !== undefined) {
    return {
      rateYear: Number(existingRateYear),
      rateUsed: null,
      calculatedAmount: null,
      frozen: true,
    };
  }

  const rateYear = new Date().getFullYear();
  const coverageGroup = await findCoverageGroupByCase(conn, caseId);
  const matchedRate = await pickRateForAdjrw(conn, {
    coverageGroup,
    rateYear,
    adjrw: nextAdjrw,
  });

  const rateUsedRaw = matchedRate?.rate_per_adjrw;
  const calcType = String(matchedRate?.calc_type || "").toUpperCase();
  const rateNum = rateUsedRaw == null ? null : Number(rateUsedRaw);
  const isActual = calcType === "ACTUAL";
  const rateUsed = isActual ? null : (Number.isFinite(rateNum) ? rateNum : null);
  const calculatedAmount = !isActual && Number.isFinite(rateUsed) && Number.isFinite(nextAdjrw)
    ? round2(nextAdjrw * rateUsed)
    : null;

  return {
    rateYear,
    rateUsed: Number.isFinite(rateUsed) ? rateUsed : null,
    calculatedAmount,
    frozen: false,
  };
}

export async function upsertCaseRw({ caseId, rw, adjrw, calcNote = null, userId = null }) {
  void calcNote;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const rwN = normNum(rw);
    const adjrwN = normNum(adjrw);

    const [[current]] = await conn.query(
      `SELECT rate_year, rate_used, calculated_amount FROM case_rw WHERE case_id = ? FOR UPDATE`,
      [caseId]
    );

    const rateSnapshot = await resolveRateSnapshot(conn, {
      caseId,
      nextAdjrw: adjrwN,
      existingRateYear: current?.rate_year ?? null,
    });

    await conn.query(
      `
      INSERT INTO case_rw (case_id, rw, adjrw, updated_by, rate_year, rate_used, calculated_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rw = VALUES(rw),
        adjrw = VALUES(adjrw),
        updated_by = VALUES(updated_by),
        updated_at = NOW(),
        rate_year = COALESCE(case_rw.rate_year, VALUES(rate_year)),
        rate_used = CASE WHEN case_rw.rate_year IS NULL THEN VALUES(rate_used) ELSE case_rw.rate_used END,
        calculated_amount = CASE WHEN case_rw.rate_year IS NULL THEN VALUES(calculated_amount) ELSE case_rw.calculated_amount END
      `,
      [caseId, rwN, adjrwN, userId, rateSnapshot.rateYear, rateSnapshot.rateUsed, rateSnapshot.calculatedAmount]
    );

    await conn.commit();

    return {
      ok: true,
      caseId,
      rw: rwN,
      adjrw: adjrwN,
      rateYear: current?.rate_year ?? rateSnapshot.rateYear,
      rateUsed: current?.rate_year == null ? rateSnapshot.rateUsed : current?.rate_used ?? null,
      calculatedAmount: current?.rate_year == null ? rateSnapshot.calculatedAmount : current?.calculated_amount ?? null,
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

export async function getCurrentPreAdjRw(caseId) {
  const [rows] = await pool.query(
    `
    SELECT
      rw,
      adjrw,
      rate_year AS rateYear,
      rate_used AS rateUsed,
      calculated_amount AS calculatedAmount
    FROM case_rw
    WHERE case_id = ?
    LIMIT 1
    `,
    [caseId]
  );

  const row = rows?.[0] || null;
  const preAdjrw = row?.adjrw == null ? 0 : Number(row.adjrw);
  const rw = row?.rw == null ? null : Number(row.rw);

  return {
    caseId: Number(caseId),
    preAdjrw: Number.isFinite(preAdjrw) ? preAdjrw : 0,
    rw: Number.isFinite(rw) ? rw : null,
    rateYear: row?.rateYear == null ? null : Number(row.rateYear),
    rateUsed: row?.rateUsed == null ? null : Number(row.rateUsed),
    calculatedAmount: row?.calculatedAmount == null ? null : Number(row.calculatedAmount),
  };
}

export async function getLatestAdjrwState(caseId) {
  const [historyRows] = await pool.query(
    `
    SELECT pre_adjrw, post_adjrw, created_at AS updated_at
    FROM case_adjrw_history
    WHERE case_id = ?
    ORDER BY id DESC
    LIMIT 1
    `,
    [caseId]
  );

  const [rwRows] = await pool.query(
    `
    SELECT rw, adjrw, rate_year AS rateYear, rate_used AS rateUsed, calculated_amount AS calculatedAmount
    FROM case_rw
    WHERE case_id = ?
    LIMIT 1
    `,
    [caseId]
  );

  const history = historyRows?.[0] || null;
  const rwRow = rwRows?.[0] || null;

  const rw = rwRow?.rw == null ? null : Number(rwRow.rw);
  const currentAdjrw = rwRow?.adjrw == null ? 0 : Number(rwRow.adjrw);
  const preAdjrw = history?.pre_adjrw == null ? currentAdjrw : Number(history.pre_adjrw);
  const postAdjrw = history?.post_adjrw == null ? currentAdjrw : Number(history.post_adjrw);
  const rateYear = rwRow?.rateYear == null ? null : Number(rwRow.rateYear);
  const rateUsed = rwRow?.rateUsed == null ? null : Number(rwRow.rateUsed);
  const calculatedAmount = rwRow?.calculatedAmount == null ? null : Number(rwRow.calculatedAmount);

  return {
    caseId: Number(caseId),
    rw: Number.isFinite(rw) ? rw : null,
    preAdjrw: Number.isFinite(preAdjrw) ? preAdjrw : 0,
    postAdjrw: Number.isFinite(postAdjrw) ? postAdjrw : 0,
    rateYear: Number.isFinite(rateYear) ? rateYear : null,
    rateUsed: Number.isFinite(rateUsed) ? rateUsed : null,
    calculatedAmount: Number.isFinite(calculatedAmount) ? calculatedAmount : null,
  };
}

export async function saveAdjRwWithHistory({
  caseId,
  postAdjrw,
  rw = undefined,
  userId = null,
  source = "CODER_FORM",
}) {
  void source;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[current]] = await conn.query(
      `SELECT rw, adjrw, rate_year, rate_used, calculated_amount FROM case_rw WHERE case_id = ? FOR UPDATE`,
      [caseId]
    );

    const preAdjrw = current?.adjrw == null ? 0 : Number(current.adjrw);
    const preRw = current?.rw == null ? null : Number(current.rw);

    const nextAdjrw = normNum(postAdjrw);
    if (nextAdjrw === null) {
      const err = new Error("postAdjrw must be a valid number");
      err.status = 400;
      throw err;
    }

    const nextRw = rw === undefined ? preRw : normNum(rw);
    const rateSnapshot = await resolveRateSnapshot(conn, {
      caseId,
      nextAdjrw,
      existingRateYear: current?.rate_year ?? null,
    });

    await conn.query(
      `
      INSERT INTO case_rw (case_id, rw, adjrw, updated_by, rate_year, rate_used, calculated_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rw = VALUES(rw),
        adjrw = VALUES(adjrw),
        updated_by = VALUES(updated_by),
        updated_at = NOW(),
        rate_year = COALESCE(case_rw.rate_year, VALUES(rate_year)),
        rate_used = CASE WHEN case_rw.rate_year IS NULL THEN VALUES(rate_used) ELSE case_rw.rate_used END,
        calculated_amount = CASE WHEN case_rw.rate_year IS NULL THEN VALUES(calculated_amount) ELSE case_rw.calculated_amount END
      `,
      [caseId, nextRw, nextAdjrw, userId, rateSnapshot.rateYear, rateSnapshot.rateUsed, rateSnapshot.calculatedAmount]
    );

    await conn.query(
      `
      INSERT INTO case_adjrw_history (case_id, pre_adjrw, post_adjrw, updated_by)
      VALUES (?, ?, ?, ?)
      `,
      [caseId, preAdjrw, nextAdjrw, userId]
    );

    await conn.commit();
    return {
      ok: true,
      caseId: Number(caseId),
      preAdjrw,
      postAdjrw: nextAdjrw,
      rw: nextRw,
      rateYear: current?.rate_year ?? rateSnapshot.rateYear,
      rateUsed: current?.rate_year == null ? rateSnapshot.rateUsed : current?.rate_used ?? null,
      calculatedAmount: current?.rate_year == null ? rateSnapshot.calculatedAmount : current?.calculated_amount ?? null,
      historicalRateLocked: current?.rate_year != null,
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}
