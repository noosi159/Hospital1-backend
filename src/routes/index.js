import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import casesRoutes from "./cases.routes.js";
import coverageRoutes from "./coverage.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/api/users", usersRoutes);
router.use("/api/cases", casesRoutes);
router.use("/api/coverage-rates", coverageRoutes);
router.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend" });
});

export default router;
