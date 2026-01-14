import pool from "../db/pool.js";

function toNumOrNull(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function list({ fiscal_year } = {}) {
  let sql = `
    SELECT id, coverage_code, coverage_name, fiscal_year,
           adjrw_min, adjrw_max, calc_type, rate_per_adjrw,
           is_active, updated_at
    FROM coverage_rates
    WHERE is_active = 1
  `;
  const params = [];

  if (fiscal_year) {
    sql += " AND fiscal_year = ?";
    params.push(fiscal_year);
  }

  sql += " ORDER BY coverage_code, adjrw_min IS NULL, adjrw_min ASC, id ASC";

  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function update(id, body) {

  const fiscal_year = body.fiscal_year ? Number(body.fiscal_year) : null;
  const adjrw_min = body.adjrw_min === undefined ? undefined : toNumOrNull(body.adjrw_min);
  const adjrw_max = body.adjrw_max === undefined ? undefined : toNumOrNull(body.adjrw_max);
  const calc_type = body.calc_type ? String(body.calc_type).toUpperCase() : null;
  const rate_per_adjrw = body.rate_per_adjrw === undefined ? undefined : toNumOrNull(body.rate_per_adjrw);
  const is_active = body.is_active === undefined ? undefined : (body.is_active ? 1 : 0);

  if (calc_type && !["RATE", "ACTUAL"].includes(calc_type)) {
    throw new Error("calc_type must be RATE or ACTUAL");
  }
  if (adjrw_min !== undefined && adjrw_max !== undefined && adjrw_min !== null && adjrw_max !== null && adjrw_min > adjrw_max) {
    throw new Error("adjrw_min must be <= adjrw_max");
  }
  if (calc_type === "ACTUAL" && rate_per_adjrw !== undefined && rate_per_adjrw !== null) {
    throw new Error("ACTUAL must have rate_per_adjrw = null");
  }

 
  const sets = [];
  const params = [];

  if (fiscal_year !== null) { sets.push("fiscal_year = ?"); params.push(fiscal_year); }
  if (adjrw_min !== undefined) { sets.push("adjrw_min = ?"); params.push(adjrw_min); }
  if (adjrw_max !== undefined) { sets.push("adjrw_max = ?"); params.push(adjrw_max); }
  if (calc_type !== null) { sets.push("calc_type = ?"); params.push(calc_type); }
  if (rate_per_adjrw !== undefined) { sets.push("rate_per_adjrw = ?"); params.push(rate_per_adjrw); }
  if (is_active !== undefined) { sets.push("is_active = ?"); params.push(is_active); }

  if (sets.length === 0) return;

  params.push(id);

  await pool.query(
    `UPDATE coverage_rates SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
}
