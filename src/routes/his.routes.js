// file รวม API ที่ที่แอมทำให้จาก รพ

import { Router } from "express";

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
  // รองรับพิมพ์แบบไม่มีจุด เช่น E119
  return /^[A-Z]\d{2}(\.\d{1,4})?$/.test(s) || /^[A-Z]\d{3,6}$/.test(s);
}

function looksLikeIcd9Code(q) {
  const s = normalizeQuery(q).toUpperCase().replace(/\s+/g, "");
  if (!s) return false;
  return /^\d{2,3}(\.\d{1,4})?$/.test(s) || /^\d{3,7}$/.test(s);
}

function pickNameAndCode({ kind, query, name, code }) {
  // ถ้าส่ง name/code มาโดยตรง ให้ใช้ตามนั้น
  const n0 = normalizeQuery(name);
  const c0 = normalizeQuery(code);
  if (n0 || c0) return { name: n0 || "_", code: c0 || "_" };

  const q = normalizeQuery(query);
  if (!q) return { name: "_", code: "_" };

  const isCode = kind === "icd10" ? looksLikeIcd10Code(q) : looksLikeIcd9Code(q);

  // ถ้าเป็นรหัส → ใส่ไปช่อง code, ถ้าเป็นชื่อ → ใส่ไปช่อง name
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

export default router;
