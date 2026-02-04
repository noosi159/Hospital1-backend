import express from "express";
import { listAllCases, acceptCase } from "../controllers/coder.controller.js";
import {exportToAuditor ,loadForm} from "../controllers/coder.snapshot.controller.js";
import * as draft from "../controllers/coder.draft.controller.js";


const router = express.Router();

router.get("/cases", listAllCases);
router.post("/cases/:caseId/accept", acceptCase);

router.get("/cases/:caseId/form", loadForm);
router.post("/cases/:caseId/export-to-auditor", exportToAuditor);

router.get("/cases/:caseId/draft", draft.getDraft);
router.post("/cases/:caseId/draft", draft.saveDraft);
router.delete("/cases/:caseId/draft", draft.clearDraft);


export default router;
