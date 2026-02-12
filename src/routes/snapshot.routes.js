import { Router } from "express";
import * as c from "../controllers/snapshot.controller.js";

const r = Router();


r.get("/cases/:caseId/snapshots", c.listCaseSnapshots);


r.get("/snapshots/:id", c.readSnapshot);

export default r;
