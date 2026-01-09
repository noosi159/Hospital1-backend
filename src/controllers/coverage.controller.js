import * as service from "../services/coverage.service.js";

export async function list(req, res) {
  try {
    const fiscal_year = req.query.fiscal_year
      ? Number(req.query.fiscal_year)
      : undefined;

    const rows = await service.list({ fiscal_year });
    return res.json(rows); // ✅ return array เหมือน list users
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Load coverage rates failed" });
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
    return res.status(500).json({ message: "Update coverage rate failed" });
  }
}
