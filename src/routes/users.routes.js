// src/routes/users.routes.js
import { Router } from "express";
import * as users from "../controllers/users.controller.js";

const router = Router();

router.get("/", users.list);
router.post("/", users.create);
router.patch("/:id", users.update);
router.delete("/:id", users.remove);
router.post("/:id/reset-password", users.resetPassword);

export default router;
