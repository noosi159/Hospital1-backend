import { Router } from "express";
import * as controller from "../controllers/coverage.controller.js";

const router = Router();
router.get("/", controller.list);
router.put("/:id", controller.update);

export default router;
