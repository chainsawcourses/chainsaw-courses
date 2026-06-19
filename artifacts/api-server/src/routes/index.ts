import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import modulesRouter from "./modules";
import progressRouter from "./progress";
import quizzesRouter from "./quizzes";
import waiverRouter from "./waiver";
import aiRouter from "./ai";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(modulesRouter);
router.use(progressRouter);
router.use(quizzesRouter);
router.use(waiverRouter);
router.use(aiRouter);
router.use(adminRouter);

export default router;
