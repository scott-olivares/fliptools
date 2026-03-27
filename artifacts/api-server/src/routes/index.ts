import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dealsRouter from "./deals";
import compsRouter from "./comps";
import seedRouter from "./seed";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dealsRouter);
router.use(compsRouter);
router.use(seedRouter);

export default router;
