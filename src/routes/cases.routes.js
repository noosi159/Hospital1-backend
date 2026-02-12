import { Router } from "express";
import * as controller from "../controllers/cases.controller.js";

const router = Router();


router.get("/", controller.list);
router.get("/:caseId", controller.getById);

router.post("/assign", controller.assign);

export default router;
