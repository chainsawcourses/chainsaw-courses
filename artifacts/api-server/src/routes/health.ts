import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const sendHealth = (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
};

// Replit's deployment monitor probes the API artifact's preview path.
router.get("/", sendHealth);
router.get("/healthz", sendHealth);

export default router;
