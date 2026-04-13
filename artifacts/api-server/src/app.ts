import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import healthRouter from "./routes/health.js";
import geocodeRouter from "./routes/geocode.js";
import propertiesRouter from "./routes/properties.js";
import { logger } from "./lib/logger";
import { requireAuth } from "./middleware/requireAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes — no auth required
app.use("/api", healthRouter); // /api/healthz — uptime check
app.use("/api", geocodeRouter); // /api/geocode/autocomplete — no user data
app.use("/api", propertiesRouter); // /api/properties/lookup — no user data

// All other API routes require a valid Clerk session token
app.use("/api", requireAuth, router);

// In production, serve the built frontend from deal-analyzer/dist/public.
// The frontend build is run as part of the api-server build step (see package.json).
// All non-API routes fall through to index.html to support client-side routing.
if (process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(__dirname, "../../deal-analyzer/dist/public");
  app.use(express.static(staticDir));
  app.use((_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
