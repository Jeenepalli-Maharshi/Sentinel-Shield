import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
app.disable("x-powered-by");

const sameOriginOnly: RequestHandler = (req, res, next) => {
  const origin = req.get("origin");
  if (!origin) {
    next();
    return;
  }
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  if (
    (originUrl.protocol !== "https:" && originUrl.protocol !== "http:") ||
    originUrl.host !== req.get("host")
  ) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  next();
};

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
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use("/api", sameOriginOnly);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
  }),
);

app.use(express.json({ limit: "32kb", type: "application/json" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use("/api", router);

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  req.log.error(
    { errorType: error instanceof Error ? error.name : "unknown" },
    "Unhandled request error",
  );
  res.status(500).json({ error: "The request could not be completed." });
};
app.use(errorHandler);

export default app;
