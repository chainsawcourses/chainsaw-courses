import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import modulesRouter from "./modules";
import progressRouter from "./progress";
import quizzesRouter from "./quizzes";
import examRouter from "./exam";
import feedbackRouter from "./feedback";
import waiverRouter from "./waiver";
import aiRouter from "./ai";
import adminRouter from "./admin";
import hazardsRouter from "./hazards";
import howToUseRouter from "./howToUse";
import documentsRouter from "./documents";
import inspectionsRouter from "./inspections";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(modulesRouter);
router.use(progressRouter);
router.use(quizzesRouter);
router.use(examRouter);
router.use(feedbackRouter);
router.use(waiverRouter);
router.use(aiRouter);
router.use(adminRouter);
router.use(hazardsRouter);
router.use(howToUseRouter);
router.use(documentsRouter);
router.use(inspectionsRouter);

export default router;
