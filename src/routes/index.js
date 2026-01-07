// src/routes/index.js
import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";

const router = Router();

router.use("/auth", authRoutes);      // /auth/login
router.use("/api/users", usersRoutes); // /api/users

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "backend" });
});

export default router;
