import { Router } from "express";
import * as c from "../controllers/coder.snapshot.controller.js";

const r = Router();

r.get("/coder/available", c.listAvailable);
r.post("/coder/cases/:caseId/claim", c.claimCase);
r.get("/coder/cases/:caseId/form", c.loadForm);
r.post("/coder/cases/:caseId/draft", c.saveDraft);
r.post("/coder/cases/:caseId/export-to-auditor", c.exportToAuditor);

export default r;
