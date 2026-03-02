import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { createError } from "./errors.js";
import { rowToJson } from "./serializers.js";
import { getDb } from "../db/sqlite.js";
import { insertAuditLog } from "../services/audit-log.js";
import { getCustomerAccountOrThrow, getCustomerOrThrow } from "../services/customer-access.js";
import { requireMarketContext } from "../services/market-context.js";
import { authorize, requireRoleHeader } from "../middleware/rbac.js";
import { DATA_DIR } from "../config/env.js";
import { registerHealthRoute } from "../routes/registerHealthRoute.js";
import { registerCustomerContextRoutes } from "../routes/admin/registerCustomerContextRoutes.js";
import { registerAuditRoutes } from "../routes/admin/registerAuditRoutes.js";
import { registerCustomerRoutes } from "../routes/admin/registerCustomerRoutes.js";
import { registerUploadRoutes } from "../routes/admin/registerUploadRoutes.js";
import { registerMarketRoutes } from "../routes/admin/registerMarketRoutes.js";
import { registerCustomerDataReadRoutes } from "../routes/admin/registerCustomerDataReadRoutes.js";

function nowIso() {
  return new Date().toISOString();
}

export function createApp() {
  const app = express();
  const db = getDb();
  const uploadDir = path.join(DATA_DIR, "uploads");
  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const safeName = `${Date.now()}-${file.originalname.replace(/[^\w.-]/g, "_")}`;
        cb(null, safeName);
      },
    }),
  });

  app.use(cors());
  app.use(express.json());
  app.use(requireRoleHeader);

  registerHealthRoute(app, { nowIso });
  registerCustomerContextRoutes(app, { authorize, db });
  registerCustomerRoutes(app, {
    authorize,
    createError,
    db,
    getCustomerAccountOrThrow,
    getCustomerOrThrow,
    insertAuditLog,
    nowIso,
  });
  registerUploadRoutes(app, {
    authorize,
    createError,
    db,
    getCustomerOrThrow,
    insertAuditLog,
    upload,
  });
  registerMarketRoutes(app, {
    authorize,
    createError,
    db,
    getCustomerOrThrow,
    insertAuditLog,
    requireMarketContext,
    rowToJson,
  });
  registerCustomerDataReadRoutes(app, {
    authorize,
    db,
    getCustomerOrThrow,
  });

  registerAuditRoutes(app, { authorize, db });

  app.use((error, _req, res, _next) => {
    const status = error.status || 400;
    res.status(status).json({
      error: "request_failed",
      message: error.message || "Request failed",
    });
  });

  return app;
}
