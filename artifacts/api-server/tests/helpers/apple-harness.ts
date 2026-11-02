import express from "express";
import appleRouter from "../../src/routes/applePurchases";
import authRouter from "../../src/routes/auth";
export * from "../../src/lib/appleAccounts";
export * from "../../src/lib/appleVerification";
export { resolveUser } from "../../src/routes/auth";
export { pool } from "./apple-db";
export const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as any).log = { error() {}, warn() {}, info() {} };
  next();
});
app.use("/api", appleRouter);
app.use("/api", authRouter);
