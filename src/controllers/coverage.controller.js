import * as service from "../services/coverage.service.js";

export async function list(req, res) {
  try {
    const yearRaw = req.query.year ?? req.query.rate_year ?? req.query.fiscal_year;
    const rate_year = yearRaw !== undefined ? Number(yearRaw) : undefined;
    const coverage_group = req.query.coverage_group
      ? String(req.query.coverage_group)
      : undefined;

    const rows = await service.list({ rate_year, coverage_group });
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Load coverage rates failed" });
  }
}

export async function match(req, res) {
  try {
    const coverage_group = String(req.query.coverage_group || "").trim();
    const adjrw = req.query.adjrw;
    const rate_year = req.query.rate_year
      ? Number(req.query.rate_year)
      : new Date().getFullYear();

    if (!coverage_group) {
      return res.status(400).json({ message: "coverage_group is required" });
    }

    const matched = await service.findMatchedRate({ coverage_group, adjrw, rate_year });
    const adjrwN = Number(adjrw);
    const calcType = String(matched?.calc_type || "").toUpperCase();
    const amount = matched && Number.isFinite(adjrwN) && calcType !== "ACTUAL"
      ? Math.round((adjrwN * Number(matched.rate_per_adjrw) + Number.EPSILON) * 100) / 100
      : null;

    return res.json({
      coverage_group: coverage_group.toUpperCase(),
      rate_year,
      adjrw: Number.isFinite(adjrwN) ? adjrwN : null,
      matched_rate: matched,
      calculated_amount: amount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Match coverage rate failed" });
  }
}

export async function upsert(req, res) {
  try {
    const result = await service.create(req.body || {});
    return res.json({
      message: result.created ? "Coverage rate created" : "Coverage rate updated",
      ...result,
    });
  } catch (err) {
    console.error(err);
    const status = /must be|required|Invalid/.test(String(err.message || "")) ? 400 : 500;
    return res.status(status).json({ message: err.message || "Save coverage rate failed" });
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });

    await service.update(id, req.body);
    return res.json({ message: "Coverage rate updated" });
  } catch (err) {
    console.error(err);
    const status = /must be|required/.test(String(err.message || "")) ? 400 : 500;
    return res.status(status).json({ message: err.message || "Update coverage rate failed" });
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid id" });
    await service.remove(id);
    return res.json({ message: "Coverage rate deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Delete coverage rate failed" });
  }
}
