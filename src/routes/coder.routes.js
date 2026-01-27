import express from "express";
import { listAllCases, acceptCase } from "../controllers/coder.controller.js";
import {exportToAuditor} from "../controllers/coder.snapshot.controller.js";
const router = express.Router();

router.get("/cases", listAllCases);
router.post("/cases/:caseId/accept", acceptCase);
router.post("/cases/:caseId/export-to-auditor", exportToAuditor);

export default router;
