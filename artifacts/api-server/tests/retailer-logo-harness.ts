import express from "express";
import pinoHttp from "pino-http";
import adminRouter from "../src/routes/admin";
import adminRetailersRouter from "../src/routes/adminRetailers";
import retailersRouter from "../src/routes/retailers";

const app = express();
app.use(express.json());
app.use(pinoHttp());
app.use("/api", adminRouter);
app.use("/api", adminRetailersRouter);
app.use("/api", retailersRouter);

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("A valid PORT is required for the retailer logo test harness");
}

app.listen(port, "127.0.0.1", () => {
  console.info(`Server listening on ${port}`);
});