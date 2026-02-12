import { Router } from "express";
import * as controller from "../controllers/coverage.controller.js";

const router = Router();
router.get("/", controller.list);
router.get("/match", controller.match);
router.post("/", controller.upsert);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
