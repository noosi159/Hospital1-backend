import pool from "../db/pool.js";

function toNumOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeGroup(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim().toUpperCase();
  return s || undefined;
}

function normalizeCalcType(v) {
  const t = String(v || "RATE").trim().toUpperCase();
  return t === "ACTUAL" ? "ACTUAL" : "RATE";
}

function toFiniteOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

function validateRange({ adjrw_min, adjrw_max }) {
  if (adjrw_min !== null && adjrw_max !== null && adjrw_min > adjrw_max) {
    const err = new Error("adjrw_min must be <= adjrw_max");
    err.status = 400;
    throw err;
  }
}

async function ensureDefaultRates2026(year) {
  if (Number(year) !== 2026) return;

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM coverage_rates WHERE rate_year = ?`,
    [year]
  );

  if (Number(countRow?.total || 0) > 0) return;

  const defaults = [
    ["UC", 2026, null, null, 7600, "RATE"],
    ["GOV", 2026, null, null, 10760, "RATE"],
    ["LOCAL", 2026, null, null, 10974, "RATE"],
    ["SSS", 2026, null, 1.99, null, "ACTUAL"],
    ["SSS", 2026, 2, null, 12000, "RATE"],
    ["PROBLEM", 2026, null, null, 8350, "RATE"],
    ["FOREIGN", 2026, null, 3.99, 9600, "RATE"],
    ["FOREIGN", 2026, 4, null, 10300, "RATE"],
  ];

  await pool.query(
    `
    INSERT INTO coverage_rates
      (coverage_group, rate_year, adjrw_min, adjrw_max, rate_per_adjrw, calc_type)
    VALUES ?
    `,
    [defaults]
  );
}

export async function list({ rate_year, coverage_group } = {}) {
  const year = Number.isInteger(Number(rate_year))
    ? Number(rate_year)
    : new Date().getFullYear();

  await ensureDefaultRates2026(year);

  let sql = `
    SELECT
      id,
      coverage_group,
      coverage_group AS coverage_code,
      coverage_group AS coverage_name,
      adjrw_min,
      adjrw_max,
      calc_type,
      rate_per_adjrw,
      rate_year,
      created_at
    FROM coverage_rates
    WHERE rate_year = ?
  `;

  const params = [year];

  const group = normalizeGroup(coverage_group);
  if (group) {
    sql += " AND coverage_group = ?";
    params.push(group);
  }

  sql += " ORDER BY coverage_group ASC, adjrw_min IS NULL, adjrw_min ASC";

  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function findMatchedRate({ coverage_group, adjrw, rate_year }) {
  const group = normalizeGroup(coverage_group);
  const a = toNumOrNull(adjrw);
  const y = Number(rate_year);

  if (!group || a === null || !Number.isInteger(y)) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      id,
      coverage_group,
      adjrw_min,
      adjrw_max,
      calc_type,
      rate_per_adjrw,
      rate_year
    FROM coverage_rates
    WHERE coverage_group = ?
      AND rate_year = ?
    ORDER BY id DESC
    `,
    [group, y]
  );

  const matched = (rows || []).filter((r) => matchesAdjrw(r, a)).sort(compareMatchedRows);
  return matched[0] || null;
}

export async function update(id, body) {
  const coverage_group = body.coverage_group === undefined
    ? undefined
    : normalizeGroup(body.coverage_group);

  const rate_year = body.rate_year === undefined && body.fiscal_year === undefined
    ? undefined
    : Number(body.rate_year ?? body.fiscal_year);

  const adjrw_min = body.adjrw_min === undefined ? undefined : toNumOrNull(body.adjrw_min);
  const adjrw_max = body.adjrw_max === undefined ? undefined : toNumOrNull(body.adjrw_max);
  const rate_per_adjrw = body.rate_per_adjrw === undefined ? undefined : toNumOrNull(body.rate_per_adjrw);
  const calc_type = body.calc_type === undefined ? undefined : normalizeCalcType(body.calc_type);

  if (coverage_group !== undefined && !coverage_group) {
    const err = new Error("coverage_group is required");
    err.status = 400;
    throw err;
  }

  if (rate_year !== undefined && !Number.isInteger(rate_year)) {
    const err = new Error("rate_year must be an integer");
    err.status = 400;
    throw err;
  }

  const nextCalcType = calc_type || "RATE";
  if (rate_per_adjrw !== undefined && nextCalcType !== "ACTUAL" && (rate_per_adjrw === null || rate_per_adjrw < 0)) {
    const err = new Error("rate_per_adjrw must be >= 0");
    err.status = 400;
    throw err;
  }

  if (adjrw_min !== undefined && adjrw_max !== undefined) {
    validateRange({ adjrw_min, adjrw_max });
  }

  const sets = [];
  const params = [];

  if (coverage_group !== undefined) { sets.push("coverage_group = ?"); params.push(coverage_group); }
  if (rate_year !== undefined) { sets.push("rate_year = ?"); params.push(rate_year); }
  if (adjrw_min !== undefined) { sets.push("adjrw_min = ?"); params.push(adjrw_min); }
  if (adjrw_max !== undefined) { sets.push("adjrw_max = ?"); params.push(adjrw_max); }
  if (calc_type !== undefined) { sets.push("calc_type = ?"); params.push(calc_type); }
  if (rate_per_adjrw !== undefined) { sets.push("rate_per_adjrw = ?"); params.push(rate_per_adjrw); }

  if (!sets.length) return { id };

  params.push(id);
  await pool.query(`UPDATE coverage_rates SET ${sets.join(", ")} WHERE id = ?`, params);
  return { id };
}

export async function create(body) {
  const coverage_group = normalizeGroup(body.coverage_group);
  const rate_year = Number(body.rate_year ?? body.fiscal_year);
  const adjrw_min = toNumOrNull(body.adjrw_min);
  const adjrw_max = toNumOrNull(body.adjrw_max);
  const rate_per_adjrw = toNumOrNull(body.rate_per_adjrw);
  const calc_type = normalizeCalcType(body.calc_type);

  if (!coverage_group) {
    const err = new Error("coverage_group is required");
    err.status = 400;
    throw err;
  }

  if (!Number.isInteger(rate_year)) {
    const err = new Error("rate_year must be an integer");
    err.status = 400;
    throw err;
  }

  if (calc_type !== "ACTUAL" && (rate_per_adjrw === null || rate_per_adjrw < 0)) {
    const err = new Error("rate_per_adjrw must be >= 0");
    err.status = 400;
    throw err;
  }

  validateRange({ adjrw_min, adjrw_max });

  const [result] = await pool.query(
    `
    INSERT INTO coverage_rates (coverage_group, rate_year, adjrw_min, adjrw_max, rate_per_adjrw, calc_type)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      rate_per_adjrw = VALUES(rate_per_adjrw),
      calc_type = VALUES(calc_type)
    `,
    [coverage_group, rate_year, adjrw_min, adjrw_max, rate_per_adjrw, calc_type]
  );

  return { id: result.insertId || null, created: true };
}

export async function remove(id) {
  await pool.query(`DELETE FROM coverage_rates WHERE id = ?`, [id]);
  return { id };
}
