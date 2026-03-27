import { Router } from "express";
import { lookupProperty, isRentCastConfigured } from "../lib/rentcastProvider.js";

const router = Router();

router.get("/properties/lookup", async (req, res): Promise<void> => {
  const address = String(req.query.address ?? "").trim();

  if (!address || address.length < 5) {
    res.status(400).json({ error: "address query param is required (min 5 chars)" });
    return;
  }

  if (!isRentCastConfigured()) {
    res.status(503).json({ error: "Property lookup not available — RENTCAST_API_KEY is not configured" });
    return;
  }

  try {
    const result = await lookupProperty(address);
    if (!result) {
      res.status(404).json({ error: "No property record found for that address" });
      return;
    }
    res.json(result);
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    if (msg.includes("Invalid RentCast API key")) {
      res.status(502).json({ error: "RentCast API key is invalid" });
    } else {
      res.status(502).json({ error: `Property lookup failed: ${msg}` });
    }
  }
});

export default router;
