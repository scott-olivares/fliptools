/**
 * Clerk authentication middleware for Express.
 *
 * Verifies the Clerk session token on every protected /api/* request.
 * Attaches userId to res.locals so route handlers can scope data per user.
 *
 * Requires env var: CLERK_SECRET_KEY (sk_...)
 *
 * Token is read from:
 *   1. Authorization: Bearer <token>  (API clients, frontend fetch with getToken())
 */

import { verifyToken } from "@clerk/backend";
import type { Request, Response, NextFunction } from "express";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload?.sub) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Attach Clerk userId to res.locals for all downstream route handlers
    res.locals.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
