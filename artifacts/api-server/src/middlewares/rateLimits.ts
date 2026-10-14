import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { getUserId } from "./requireAuth";

export const workspaceRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => getUserId(req),
  message: { error: "Too many requests. Try again in a minute." },
});

export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req: Request) => getUserId(req),
  message: { error: "Too many changes. Try again in a minute." },
});
