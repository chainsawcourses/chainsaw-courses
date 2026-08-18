import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { loadAllAiResources } from "./lib/ai-resource";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(
  express.json({
    limit: "2mb",
    verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

// Prevent browser caching of API responses — module lock state changes dynamically
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Serve uploaded question images as static files
app.use("/question-images/uploads", express.static(path.join(__dirname, "../uploads/question-images")));
// Serve uploaded question audio as static files
app.use("/question-audio/uploads", express.static(path.join(__dirname, "../uploads/question-audio")));

app.use("/api", router);

// Temporary: serve pre-built iOS dist as a download
app.get("/download-ios-dist", (_req, res) => {
  res.download(path.join(__dirname, "../dist-public.zip"), "dist-public.zip");
});

// Temporary: iPad preview video download
app.get("/download-ipad-preview", (_req, res) => {
  res.download(path.join(__dirname, "../chainsaw_ipad_preview.mp4"), "chainsaw_ipad_preview.mp4");
});

// Pre-load AI reference resources (manual + Q&A) on startup
loadAllAiResources();

export default app;
