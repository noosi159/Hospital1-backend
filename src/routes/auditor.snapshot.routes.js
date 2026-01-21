import { Router } from "express";
import * as c from "../controllers/auditor.snapshot.controller.js";

const r = Router();


r.post("/auditor/cases/:caseId/draft", c.saveDraft);

r.post("/auditor/cases/:caseId/export-to-coder", c.exportToCoder);

r.post("/auditor/cases/:caseId/confirm", c.confirmCase);

export default r;
