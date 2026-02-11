// file รวม API ที่ที่แอมทำให้จาก รพ

import { Router } from "express";
import { syncCasesFromHIS } from "../services/his.sync.service.js";

const router = Router();

const HIS_BASE =
  process.env.HIS_BASE_URL ||
  "";
console.log("🚀 ~ HIS_BASE:", HIS_BASE)


function normalizeQuery(q) {
  return String(q ?? "").trim();
}

function looksLikeIcd10Code(q) {
  const s = normalizeQuery(q).toUpperCase().replace(/\s+/g, "");
  if (!s) return false;

  return /^[A-Z]\d{2}(\.\d{1,4})?$/.test(s) || /^[A-Z]\d{3,6}$/.test(s);
}

function looksLikeIcd9Code(q) {
  const s = normalizeQuery(q).toUpperCase().replace(/\s+/g, "");
  if (!s) return false;
  return /^\d{2,3}(\.\d{1,4})?$/.test(s) || /^\d{3,7}$/.test(s);
}

function pickNameAndCode({ kind, query, name, code }) {
  const n0 = normalizeQuery(name);
  const c0 = normalizeQuery(code);
  if (n0 || c0) return { name: n0 || "_", code: c0 || "_" };

  const q = normalizeQuery(query);
  if (!q) return { name: "_", code: "_" };

  const isCode = kind === "icd10" ? looksLikeIcd10Code(q) : looksLikeIcd9Code(q);

 
  return isCode ? { name: "_", code: q } : { name: q, code: "_" };
}

function buildIcd10Url({ query, name, code }) {
  const picked = pickNameAndCode({ kind: "icd10", query, name, code });
  return `${HIS_BASE}/SearchIcdcode/${encodeURIComponent(picked.name)}/${encodeURIComponent(picked.code)}`;
}

function buildIcd9Url({ query, name, code }) {
  const picked = pickNameAndCode({ kind: "icd9", query, name, code });
  return `${HIS_BASE}/SearchIcd9_CM/${encodeURIComponent(picked.name)}/${encodeURIComponent(picked.code)}`;
}

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

router.get("/icd10", async (req, res) => {
  try {
    const url = buildIcd10Url({
      query: req.query.query,
      name: req.query.name,
      code: req.query.code,
    });

    const r = await fetch(url);
    const text = await r.text();

    res.status(r.status);
    res.set("content-type", r.headers.get("content-type") || "text/plain; charset=utf-8");
    res.send(text);
  } catch (err) {
    res.status(500).json({ message: "proxy icd10 failed", error: String(err) });
  }
});

router.get("/icd9", async (req, res) => {
  try {
    const url = buildIcd9Url({
      query: req.query.query,
      name: req.query.name,
      code: req.query.code,
    });

    const r = await fetch(url);
    const text = await r.text();

    res.status(r.status);
    res.set("content-type", r.headers.get("content-type") || "text/plain; charset=utf-8");
    res.send(text);
  } catch (err) {
    res.status(500).json({ message: "proxy icd9 failed", error: String(err) });
  }
});

router.get("/patients-discharge", async (req, res) => {
  try {
    const { hn, an, dc_since, dc_end } = req.query;
    const url = buildPatientsDischargeUrl({ hn, an, dc_since, dc_end });

    const r = await fetch(url);
    const text = await r.text();

    res.status(r.status);
    res.set("content-type", r.headers.get("content-type") || "application/json; charset=utf-8");
    res.send(text);
  } catch (err) {
    res.status(500).json({ message: "proxy patients-discharge failed", error: String(err) });
  }
});
router.post("/sync-discharge", async (req, res) => {
  try {
    const { hn, an, dc_since, dc_end } = req.body || {};
    const result = await syncCasesFromHIS({ hn, an, dc_since, dc_end });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, message: "sync-discharge failed", error: String(err) });
  }
});

export default router;
