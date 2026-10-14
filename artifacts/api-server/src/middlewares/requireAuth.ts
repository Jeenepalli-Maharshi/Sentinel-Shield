import { getAuth } from "@clerk/express";
import type { Request, RequestHandler } from "express";

type AuthenticatedRequest = Request & { userId: string };

export const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  (req as AuthenticatedRequest).userId = userId;
  next();
};

export function getUserId(req: Request): string {
  const userId = (req as Partial<AuthenticatedRequest>).userId;
  if (!userId) throw new Error("Authenticated user context is missing.");
  return userId;
};
