import type { VercelRequest, VercelResponse } from "@vercel/node";
import YahooFinance from "yahoo-finance2";
import fetch from "node-fetch";

const yahooFinance = new YahooFinance();

const INTRADAY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const intradayCache = new Map<string, { data: IntradayPoint[]; ts: number }>();

// ─── Symbol Helpers ───────────────────────────────────────────────────────────

function getCurrencySymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (
    clean.endsWith(".BSE") || clean.endsWith(".NSE") ||
    clean.endsWith(".BO")  || clean.endsWith(".NS")
  ) return "₹";
  if (clean.endsWith(".LON")) return "£";
  if (clean.endsWith(".FRA") || clean.endsWith(".GER") || clean.endsWith(".EU")) return "€";
  if (clean.endsWith(".TSX") || clean.endsWith(".TO")) return "C$";
  if (clean.endsWith(".AX")) return "A$";
  if (clean.endsWith(".HK")) return "HK$";
  if (clean.endsWith(".T")) return "¥";
  return "$";
}

/**
 * Converts internal symbol format to Yahoo Finance format.
 *   TCS.BSE  → TCS.BO  (Yahoo uses .BO for BSE)
 *   TCS.NSE  → TCS.NS  (Yahoo uses .NS for NSE)
 */
function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".BSE")) return upper.replace(/\.BSE$/, ".BO");
  if (upper.endsWith(".NSE")) return upper.replace(/\.NSE$/, ".NS");
  return upper;
}

/**
 * Converts symbol to STOOQ format (lowercase).
 *   TCS.NS → tcs.ns  |  AAPL → aapl.us
 */
function toStooqSymbol(symbol: string): string {
  const yahoo = toYahooSymbol(symbol).toLowerCase();
  if (!yahoo.includes(".")) return `${yahoo}.us`;
  return yahoo;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type IntradayPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizePoints(points: IntradayPoint[]): IntradayPoint[] {
  return points
    .filter((q) => q && q.date && Number.isFinite(q.close) && q.close > 0)
    .map((q) => ({
      ...q,
      open:   Number.isFinite(q.open)   && q.open   > 0 ? q.open   : q.close,
      high:   Number.isFinite(q.high)   && q.high   > 0 ? q.high   : q.close,
      low:    Number.isFinite(q.low)    && q.low    > 0 ? q.low    : q.close,
      volume: Number.isFinite(q.volume)              ? q.volume  : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Source 1: Yahoo Finance direct HTTP (primary — browser-spoofed headers) ──
// Uses v8 chart API with spoofed headers to avoid datacenter IP blocking.

async function getYahooChartDirect(symbol: string): Promise<IntradayPoint[]> {
  const yahooSym = toYahooSymbol(symbol);
  // Try two Yahoo query hosts for redundancy
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=5m&range=1d&includePrePost=true`;
      console.log(`[intraday] Yahoo direct → ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":          "application/json, */*",
          "Accept-Language": "en-US,en;q=0.9",
          "Referer":         "https://finance.yahoo.com/",
          "Origin":          "https://finance.yahoo.com",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.warn(`[intraday] Yahoo (${host}) → HTTP ${response.status} for ${yahooSym}`);
        continue;
      }

      const payload: any = await response.json();
      const result = payload?.chart?.result?.[0];
      if (!result) continue;

      const timestamps: number[] = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};

      const points: IntradayPoint[] = timestamps.map((ts, i) => ({
        date:   new Date(ts * 1000).toISOString(),
        open:   Number(quote.open?.[i]),
        high:   Number(quote.high?.[i]),
        low:    Number(quote.low?.[i]),
        close:  Number(quote.close?.[i]),
        volume: Number(quote.volume?.[i] ?? 0),
      }));

      const normalized = normalizePoints(points);
      if (normalized.length > 0) {
        console.log(`[intraday] Yahoo direct OK: ${normalized.length} pts for ${yahooSym}`);
        return normalized;
      }
    } catch (err: any) {
      console.warn(`[intraday] Yahoo (${host}) error:`, err.message || err);
    }
  }

  return [];
}

// ─── Source 2: yahoo-finance2 library (secondary — uses same Yahoo API) ───────

async function getYahooLibrary(symbol: string): Promise<IntradayPoint[]> {
  const yahooSym = toYahooSymbol(symbol);
  try {
    const period2 = new Date();
    const period1 = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2); // last 2 days

    const result: any = await yahooFinance.chart(
      yahooSym,
      { period1, period2, interval: "5m" as any, includePrePost: true },
      { validateResult: false }
    );

    const quotes = Array.isArray(result?.quotes) ? result.quotes : [];
    const normalized = normalizePoints(
      quotes.map((q: any) => ({
        date:   q.date instanceof Date ? q.date.toISOString() : new Date(q.date).toISOString(),
        open:   Number(q.open),
        high:   Number(q.high),
        low:    Number(q.low),
        close:  Number(q.close),
        volume: Number(q.volume ?? 0),
      }))
    );

    if (normalized.length > 0) {
      console.log(`[intraday] yahoo-finance2 OK: ${normalized.length} pts for ${yahooSym}`);
    }
    return normalized;
  } catch (err: any) {
    console.warn(`[intraday] yahoo-finance2 error for ${yahooSym}:`, err.message || err);
    return [];
  }
}

// ─── Source 3: STOOQ (cloud-safe final fallback — works from Vercel/AWS) ──────
// Unlike Yahoo Finance, STOOQ does NOT block cloud datacenter IPs.

async function getStooqIntraday(symbol: string): Promise<IntradayPoint[]> {
  const stooqSym = toStooqSymbol(symbol);
  try {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=5`;
    console.log(`[intraday] STOOQ fallback → ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockApp/1.0)",
        "Accept":     "text/csv,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return [];

    const text = await response.text();
    if (!text || text.includes("No data") || text.trim().length < 30) return [];

    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    if (!header.includes("date") || !header.includes("close")) return [];

    const cols  = header.split(",");
    const dIdx  = cols.indexOf("date");
    const tIdx  = cols.indexOf("time");
    const oIdx  = cols.indexOf("open");
    const hIdx  = cols.indexOf("high");
    const lIdx  = cols.indexOf("low");
    const cIdx  = cols.indexOf("close");
    const vIdx  = cols.indexOf("volume");

    const points: IntradayPoint[] = lines.slice(1).map((line) => {
      const p = line.split(",");
      const dateStr = p[dIdx]?.trim() ?? "";
      const timeStr = tIdx >= 0 ? (p[tIdx]?.trim() ?? "09:00:00") : "09:00:00";
      return {
        date:   new Date(`${dateStr}T${timeStr}`).toISOString(),
        open:   Number(p[oIdx]),
        high:   Number(p[hIdx]),
        low:    Number(p[lIdx]),
        close:  Number(p[cIdx]),
        volume: vIdx >= 0 ? Number(p[vIdx] ?? 0) : 0,
      };
    });

    const normalized = normalizePoints(points);
    console.log(`[intraday] STOOQ OK: ${normalized.length} pts for ${stooqSym}`);
    return normalized;
  } catch (err: any) {
    console.warn(`[intraday] STOOQ error for ${stooqSym}:`, err.message || err);
    return [];
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  // ── Serve from cache if fresh ────────────────────────────────────────────
  const cached = intradayCache.get(cleanSymbol);
  if (cached && Date.now() - cached.ts < INTRADAY_CACHE_TTL_MS) {
    const lastDayStr = cached.data[cached.data.length - 1].date.split("T")[0];
    return res.json({
      symbol: cleanSymbol,
      currencySymbol: getCurrencySymbol(cleanSymbol),
      data: cached.data.filter((q) => q.date.startsWith(lastDayStr)),
      tradingDay: lastDayStr,
      source: "cache",
    });
  }

  try {
    console.log(`[intraday] Fetching 1D chart for: ${cleanSymbol}`);

    // ── 1. Yahoo Finance direct HTTP (primary) ────────────────────────────
    let data = await getYahooChartDirect(cleanSymbol);

    // ── 2. yahoo-finance2 library (secondary) ─────────────────────────────
    if (data.length === 0) {
      data = await getYahooLibrary(cleanSymbol);
    }

    // ── 3. STOOQ (cloud-safe fallback for when Yahoo blocks Vercel IPs) ───
    if (data.length === 0) {
      data = await getStooqIntraday(cleanSymbol);
    }

    // ── Return data if any source succeeded ───────────────────────────────
    if (data.length > 0) {
      intradayCache.set(cleanSymbol, { data, ts: Date.now() });
      const lastDayStr = data[data.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: data.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "yahoo",
      });
    }

    // ── All sources failed ─────────────────────────────────────────────────
    const isIndian = cleanSymbol.endsWith(".BSE") || cleanSymbol.endsWith(".NSE");
    const hint = isIndian
      ? `Indian markets (BSE/NSE) may be closed. Try again during market hours (9:15 AM – 3:30 PM IST).`
      : `Markets may be closed or the symbol is invalid.`;

    return res.status(404).json({
      error: `No intraday data available for ${cleanSymbol}. ${hint}`,
    });
  } catch (error: any) {
    console.error("[intraday] Unexpected error:", error.message || error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
