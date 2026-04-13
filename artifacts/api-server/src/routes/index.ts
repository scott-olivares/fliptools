import { Router, type IRouter } from "express";
import dealsRouter from "./deals";
import compsRouter from "./comps";
import seedRouter from "./seed";
import triageRouter from "./triage";
import digestRouter from "./digest";
// Note: healthRouter, geocodeRouter, propertiesRouter are mounted publicly in app.ts — not here

const router: IRouter = Router();

router.use(dealsRouter);
router.use(compsRouter);
router.use(seedRouter);
router.use(triageRouter);
router.use(digestRouter);

export default router;
