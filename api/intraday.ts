import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";

const INTRADAY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const intradayCache = new Map<string, { data: IntradayPoint[]; ts: number }>();

// ─── Symbol Helpers ──────────────────────────────────────────────────────────

function getCurrencySymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (
    clean.endsWith(".BSE") || clean.endsWith(".NSE") ||
    clean.endsWith(".BO") || clean.endsWith(".NS")
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
 * Converts internal Alpha Vantage symbol format to Yahoo/STOOQ format.
 *   .BSE → .BO  (used by Yahoo Finance)
 *   .NSE → .NS  (used by Yahoo Finance & STOOQ)
 */
function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".BSE")) return upper.replace(/\.BSE$/, ".BO");
  if (upper.endsWith(".NSE")) return upper.replace(/\.NSE$/, ".NS");
  return upper;
}

/**
 * Converts symbol to STOOQ format.
 * STOOQ uses lowercase with a dot separator, e.g. tcs.ns
 * For US stocks: aapl.us, For Indian NSE: tcs.ns, For Indian BSE: tcs.bo
 */
function toStooqSymbol(symbol: string): string {
  const yahoo = toYahooSymbol(symbol).toLowerCase();
  // If no exchange suffix, assume US stock
  if (!yahoo.includes(".")) return `${yahoo}.us`;
  return yahoo;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type IntradayPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type IntradayFetchResult = {
  data: IntradayPoint[];
  reason?: string;
};

// ─── Data Normalization ──────────────────────────────────────────────────────

function normalizePoints(points: IntradayPoint[]): IntradayPoint[] {
  return points
    .filter((q) => q && q.date && Number.isFinite(q.close) && q.close > 0)
    .map((q) => ({
      ...q,
      open: Number.isFinite(q.open) && q.open > 0 ? q.open : q.close,
      high: Number.isFinite(q.high) && q.high > 0 ? q.high : q.close,
      low: Number.isFinite(q.low) && q.low > 0 ? q.low : q.close,
      volume: Number.isFinite(q.volume) ? q.volume : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ─── Source 1: Alpha Vantage ─────────────────────────────────────────────────

async function getAlphaIntraday(symbol: string, apiKey?: string): Promise<IntradayFetchResult> {
  if (!apiKey) return { data: [], reason: "API key not configured" };

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=full&apikey=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const payload: any = await response.json();

    if (payload?.Note || payload?.Information) {
      return { data: [], reason: "rate limit reached" };
    }
    if (payload?.ErrorMessage) {
      return { data: [], reason: "symbol unsupported by Alpha Vantage" };
    }

    const series = payload?.["Time Series (5min)"];
    if (!series || typeof series !== "object") {
      return { data: [], reason: "missing time series data" };
    }

    return {
      data: normalizePoints(
        Object.entries(series).map(([timestamp, values]: [string, any]) => ({
          date: new Date(timestamp.replace(" ", "T")).toISOString(),
          open: Number(values["1. open"]),
          high: Number(values["2. high"]),
          low: Number(values["3. low"]),
          close: Number(values["4. close"]),
          volume: Number(values["5. volume"] ?? 0),
        }))
      ),
    };
  } catch (error: any) {
    console.warn(`[intraday] Alpha Vantage failed for ${symbol}:`, error.message || error);
    return { data: [], reason: "request failed" };
  }
}

// ─── Source 2: STOOQ (cloud-safe, no auth, works on Vercel/AWS) ──────────────
// STOOQ provides free intraday CSV data. It works reliably from server IPs
// unlike Yahoo Finance which blocks AWS/Vercel egress IPs.

async function getStooqIntraday(symbol: string): Promise<IntradayPoint[]> {
  try {
    const stooqSym = toStooqSymbol(symbol);
    // STOOQ intraday: interval=5 (5-min bars), last 2 days
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=5`;
    console.log(`[intraday] Trying STOOQ: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockApp/1.0)",
        "Accept": "text/csv,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[intraday] STOOQ returned ${response.status} for ${stooqSym}`);
      return [];
    }

    const text = await response.text();
    if (!text || text.includes("No data") || text.trim().length < 30) {
      console.warn(`[intraday] STOOQ no data for ${stooqSym}`);
      return [];
    }

    // CSV format: Date,Time,Open,High,Low,Close,Volume
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const header = lines[0].toLowerCase();
    if (!header.includes("date") || !header.includes("close")) return [];

    const cols = header.split(",");
    const dateIdx = cols.indexOf("date");
    const timeIdx = cols.indexOf("time");
    const openIdx = cols.indexOf("open");
    const highIdx = cols.indexOf("high");
    const lowIdx = cols.indexOf("low");
    const closeIdx = cols.indexOf("close");
    const volIdx = cols.indexOf("volume");

    const points: IntradayPoint[] = lines.slice(1).map((line) => {
      const parts = line.split(",");
      const dateStr = parts[dateIdx]?.trim() ?? "";
      const timeStr = timeIdx >= 0 ? parts[timeIdx]?.trim() : "09:00:00";
      const isoDate = new Date(`${dateStr}T${timeStr}`).toISOString();
      return {
        date: isoDate,
        open: Number(parts[openIdx]),
        high: Number(parts[highIdx]),
        low: Number(parts[lowIdx]),
        close: Number(parts[closeIdx]),
        volume: volIdx >= 0 ? Number(parts[volIdx] ?? 0) : 0,
      };
    });

    const normalized = normalizePoints(points);
    console.log(`[intraday] STOOQ returned ${normalized.length} points for ${stooqSym}`);
    return normalized;
  } catch (error: any) {
    console.warn(`[intraday] STOOQ failed for ${symbol}:`, error.message || error);
    return [];
  }
}

// ─── Source 3: Yahoo Finance direct HTTP (with browser headers) ───────────────
// Yahoo blocks plain server requests, but spoofed browser headers often work.

async function getYahooChartDirect(symbol: string): Promise<IntradayPoint[]> {
  try {
    const yahooSym = toYahooSymbol(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=5m&range=1d&includePrePost=true`;
    console.log(`[intraday] Trying Yahoo direct: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://finance.yahoo.com/",
        "Origin": "https://finance.yahoo.com",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[intraday] Yahoo direct returned ${response.status} for ${yahooSym}`);
      return [];
    }

    const payload: any = await response.json();
    const result = payload?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens: (number | null)[] = quote.open || [];
    const highs: (number | null)[] = quote.high || [];
    const lows: (number | null)[] = quote.low || [];
    const closes: (number | null)[] = quote.close || [];
    const volumes: (number | null)[] = quote.volume || [];

    const points: IntradayPoint[] = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString(),
      open: Number(opens[i]),
      high: Number(highs[i]),
      low: Number(lows[i]),
      close: Number(closes[i]),
      volume: Number(volumes[i] ?? 0),
    }));

    const normalized = normalizePoints(points);
    console.log(`[intraday] Yahoo direct returned ${normalized.length} points for ${yahooSym}`);
    return normalized;
  } catch (error: any) {
    console.warn(`[intraday] Yahoo direct failed for ${symbol}:`, error.message || error);
    return [];
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  // Check cache first
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

    // ── 1. Alpha Vantage (best data quality, but rate-limited on free tier) ──
    const alphaResult = await getAlphaIntraday(cleanSymbol, process.env.ALPHA_VANTAGE_API_KEY);
    if (alphaResult.data.length > 0) {
      intradayCache.set(cleanSymbol, { data: alphaResult.data, ts: Date.now() });
      const lastDayStr = alphaResult.data[alphaResult.data.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: alphaResult.data.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "alpha-vantage",
      });
    }

    // ── 2. STOOQ (free, no auth, cloud-safe — works on Vercel/AWS) ──────────
    const stooqData = await getStooqIntraday(cleanSymbol);
    if (stooqData.length > 0) {
      intradayCache.set(cleanSymbol, { data: stooqData, ts: Date.now() });
      const lastDayStr = stooqData[stooqData.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: stooqData.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "stooq",
      });
    }

    // ── 3. Yahoo Finance direct HTTP (spoofed browser headers) ──────────────
    const yahooData = await getYahooChartDirect(cleanSymbol);
    if (yahooData.length > 0) {
      intradayCache.set(cleanSymbol, { data: yahooData, ts: Date.now() });
      const lastDayStr = yahooData[yahooData.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: yahooData.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "yahoo",
      });
    }

    // ── All sources failed ───────────────────────────────────────────────────
    const isIndian = cleanSymbol.endsWith(".BSE") || cleanSymbol.endsWith(".NSE");
    const hint = isIndian
      ? `Indian markets (BSE/NSE) may be closed right now or the symbol may be unavailable. Try again during market hours (9:15 AM – 3:30 PM IST).`
      : `Markets may be closed or the symbol may be invalid. Try again during market hours.`;

    return res.status(404).json({
      error: `No intraday data available for ${cleanSymbol}. ${alphaResult.reason ? `Alpha Vantage: ${alphaResult.reason}. ` : ""}${hint}`,
    });
  } catch (error: any) {
    console.error("Error fetching intraday data:", error.message || error);
    return res.status(500).json({ error: error.message || "Internal server error fetching intraday data" });
  }
}
