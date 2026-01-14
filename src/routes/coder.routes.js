import express from "express";
import { listAllCases, acceptCase } from "../controllers/coder.controller.js";

const router = express.Router();

router.get("/cases", listAllCases);
router.post("/cases/:caseId/accept", acceptCase);

export default router;
