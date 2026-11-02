import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import applePurchasesRouter from "./applePurchases";
import modulesRouter from "./modules";
import progressRouter from "./progress";
import quizzesRouter from "./quizzes";
import examRouter from "./exam";
import feedbackRouter from "./feedback";
import waiverRouter from "./waiver";
import adminRouter from "./admin";
import hazardsRouter from "./hazards";
import howToUseRouter from "./howToUse";
import documentsRouter from "./documents";
import inspectionsRouter from "./inspections";
import newsRouter from "./news";
import riskAssessmentsRouter from "./risk-assessments";
import pushRouter from "./push";
import certificateRouter from "./certificate";
import privacyPolicyRouter from "./privacyPolicy";
import gatewayRouter from "./gateway";
import adminGatewayRouter from "./adminGateway";
import retailersRouter from "./retailers";
import adminRetailersRouter from "./adminRetailers";
import adminQualityRouter from "./adminQuality";
import adminMockRouter from "./adminMock";
import shopifyWebhookRouter from "./shopifyWebhook";
import websitePurchasesRouter from "./websitePurchases";
import aiRouter from "./ai";
import billingRouter from "./billing";
import codeResetRequestsRouter from "./codeResetRequests";
import { createBackupAutomationRouter } from "./backupAutomation";
import { runScheduledBackupIfDue, getScheduledBackupRun } from "../lib/backupJobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(createBackupAutomationRouter({
  secret: () => process.env.BACKUP_TRIGGER_SECRET,
  isProduction: () => process.env.NODE_ENV === "production",
  now: () => new Date(),
  run: runScheduledBackupIfDue,
  findRun: getScheduledBackupRun,
}));
router.use(authRouter);
router.use(applePurchasesRouter);
router.use(modulesRouter);
router.use(progressRouter);
router.use(quizzesRouter);
router.use(examRouter);
router.use(feedbackRouter);
router.use(waiverRouter);
router.use(adminRouter);
router.use(hazardsRouter);
router.use(howToUseRouter);
router.use(documentsRouter);
router.use(inspectionsRouter);
router.use(newsRouter);
router.use(riskAssessmentsRouter);
router.use(pushRouter);
router.use(certificateRouter);
router.use(privacyPolicyRouter);
router.use(gatewayRouter);
router.use(adminGatewayRouter);
router.use(retailersRouter);
router.use(adminRetailersRouter);
router.use(adminQualityRouter);
router.use(adminMockRouter);
router.use(shopifyWebhookRouter);
router.use(websitePurchasesRouter);
router.use(aiRouter);
router.use(billingRouter);
router.use(codeResetRequestsRouter);

export default router;
