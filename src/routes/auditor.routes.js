import { Router } from "express";
import * as controller from "../controllers/auditor.controller.js";
import { exportToCoder } from "../controllers/auditor.snapshot.controller.js";
 import * as draft from "../controllers/auditor.draft.controller.js";

const router = Router();

router.get("/cases", controller.listMyCases);
router.post("/cases/:caseId/return", controller.returnCase);
router.get("/cases/:caseId", controller.getCaseDetail);
router.get("/cases/:caseId/diagnoses", controller.listDiagnoses);

router.put("/cases/:caseId/case-info", controller.upsertCaseInfo);
router.post("/cases/:caseId/diagnoses", controller.replaceDiagnoses);
router.delete("/diagnoses/:id", controller.deleteDiagnosis);


router.post("/cases/:caseId/export-to-coder", exportToCoder);


router.get("/cases/:caseId/draft", draft.getDraft);
router.post("/cases/:caseId/draft", draft.saveDraft);
router.delete("/cases/:caseId/draft", draft.clearDraft);
export default router;
