// routes/tools.routes.js
import express from "express";

const router = express.Router();

router.get("/rights-preview", async (req, res) => {
  try {
    const url = "http://<his-host>/.../dischargeList"; // ใส่ของจริง
    const r = await fetch(url);
    const data = await r.json();

    const map = new Map();
    for (const x of data) {
      if (x.RIGHTCODE) map.set(x.RIGHTCODE, x.RIGHTNAME || "");
    }

    res.json(
      [...map.entries()].map(([rightCode, rightName]) => ({
        rightCode,
        rightName,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
