import express from "express";
import { listAllCases, acceptCase, confirmCase } from "../controllers/coder.controller.js";
import {exportToAuditor ,loadForm} from "../controllers/coder.snapshot.controller.js";
import * as draft from "../controllers/coder.draft.controller.js";
import { getCurrentAdjrw, saveAdjrw } from "../controllers/coder.adjrw.controller.js";


const router = express.Router();

router.get("/cases", listAllCases);
router.post("/cases/:caseId/accept", acceptCase);
router.post("/cases/:caseId/confirm", confirmCase);

router.get("/cases/:caseId/form", loadForm);
router.post("/cases/:caseId/export-to-auditor", exportToAuditor);
router.get("/cases/:caseId/adjrw/current", getCurrentAdjrw);
router.post("/cases/:caseId/adjrw", saveAdjrw);

router.get("/cases/:caseId/draft", draft.getDraft);
router.post("/cases/:caseId/draft", draft.saveDraft);
router.delete("/cases/:caseId/draft", draft.clearDraft);


export default router;
