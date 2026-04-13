import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dealsRouter from "./deals";
import compsRouter from "./comps";
import seedRouter from "./seed";
import propertiesRouter from "./properties";
import triageRouter from "./triage";
import digestRouter from "./digest";
// Note: geocodeRouter is mounted publicly in app.ts — not here

const router: IRouter = Router();

router.use(healthRouter);
router.use(dealsRouter);
router.use(compsRouter);
router.use(seedRouter);
router.use(propertiesRouter);
router.use(triageRouter);
router.use(digestRouter);

export default router;
