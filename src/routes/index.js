import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";
import casesRoutes from "./cases.routes.js";
import coverageRoutes from "./coverage.routes.js";
import auditorRoutes from "./auditor.routes.js";  
import coderRoutes from "./coder.routes.js";
import snapshotRoutes from "./snapshot.routes.js";
import auditorSnapshotRoutes from "./auditor.snapshot.routes.js";
import coderSnapshotRoutes from "./coder.snapshot.routes.js";


const router = Router();

router.use("/auth", authRoutes);
router.use("/api/users", usersRoutes);
router.use("/api/cases", casesRoutes);
router.use("/api/auditor", auditorRoutes); 
router.use("/api/coverage-rates", coverageRoutes);
router.use("/api/coder", coderRoutes);
router.use("/api", snapshotRoutes);
router.use("/api", auditorSnapshotRoutes);
router.use("/api", coderSnapshotRoutes);

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend" });
});

export default router;
