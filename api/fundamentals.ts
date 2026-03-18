import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";

// ── 24h cache for AV OVERVIEW fundamentals ───────────────────────────────────
// Note: In a serverless environment like Vercel, this cache is only maintained 
// for the lifetime of the specific lambda instance.
const OVERVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const overviewCache = new Map<string, { data: any; ts: number }>();

const safeNum = (v: string | undefined): number | null => {
  if (!v || v === "None" || v === "-" || v.trim() === "") return null;
  const n = parseFloat(v.replace(/[,$%]/g, "").trim());
  return isNaN(n) ? null : n;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { symbol } = req.query;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol required" });
  }
  if (!apiKey) {
    return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY not configured" });
  }

  const sym = symbol.trim().toUpperCase();

  // Serve from cache if fresh
  const cached = overviewCache.get(sym);
  if (cached && Date.now() - cached.ts < OVERVIEW_CACHE_TTL_MS) {
    console.log(`[fundamentals] Cache HIT for ${sym}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[fundamentals] Fetching OVERVIEW for ${sym}`);
    const ovRes = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${sym}&apikey=${apiKey}`
    );
    const ov: any = await ovRes.json();

    if (ov["Note"] || ov["Information"]) {
      console.warn(`[fundamentals] Rate-limited for ${sym}`);
      // Return nulls — frontend shows N/A and caller can retry later
      return res.json({ peRatio: null, forwardPE: null, divYield: null, marketCap: null, beta: null, eps: null, week52High: null, week52Low: null, sector: null, industry: null, rateLimited: true });
    }

    const payload = {
      peRatio:    safeNum(ov["TrailingPE"]),
      forwardPE:  safeNum(ov["ForwardPE"]),
      divYield:   safeNum(ov["DividendYield"]),
      marketCap:  safeNum(ov["MarketCapitalization"]),
      beta:       safeNum(ov["Beta"]),
      eps:        safeNum(ov["EPS"]),
      week52High: safeNum(ov["52WeekHigh"]),
      week52Low:  safeNum(ov["52WeekLow"]),
      sector:     (ov["Sector"] && ov["Sector"] !== "None") ? ov["Sector"] : null,
      industry:   (ov["Industry"] && ov["Industry"] !== "None") ? ov["Industry"] : null,
    };

    console.log(`[fundamentals] OK for ${sym}: PE=${payload.peRatio}, MCap=${payload.marketCap}, EPS=${payload.eps}`);
    overviewCache.set(sym, { data: payload, ts: Date.now() });
    return res.json(payload);
  } catch (err) {
    console.error("[fundamentals] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
