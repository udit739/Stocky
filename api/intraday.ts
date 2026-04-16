import type { VercelRequest, VercelResponse } from "@vercel/node";
import YahooFinance from "yahoo-finance2";
import fetch from "node-fetch";
const yahooFinance = new YahooFinance();

const INTRADAY_CACHE_TTL_MS = 60 * 1000;
const intradayCache = new Map<string, { data: IntradayPoint[]; ts: number }>();

function getCurrencySymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith(".BSE") || clean.endsWith(".NSE") || clean.endsWith(".BO") || clean.endsWith(".NS")) return "₹";
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
 * Alpha Vantage uses .BSE / .NSE; Yahoo Finance uses .BO / .NS
 */
function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".BSE")) return upper.replace(/\.BSE$/, ".BO");
  if (upper.endsWith(".NSE")) return upper.replace(/\.NSE$/, ".NS");
  return upper;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
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

  try {
    console.log(`[intraday] Fetching 1D chart for: ${cleanSymbol}`);

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

    const cached = intradayCache.get(cleanSymbol);
    if (alphaResult.reason === "rate limit reached" && cached && Date.now() - cached.ts < INTRADAY_CACHE_TTL_MS) {
      const lastDayStr = cached.data[cached.data.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: cached.data.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "cache",
        warning: "Alpha Vantage rate limit reached; serving cached intraday data.",
      });
    }

    // Convert symbol to Yahoo Finance format before querying Yahoo
    const yahooSymbol = toYahooSymbol(cleanSymbol);
    console.log(`[intraday] Trying Yahoo Finance with symbol: ${yahooSymbol}`);

    const yahooData = await getYahooIntraday(yahooSymbol);
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

    const hint = cleanSymbol.endsWith(".BSE") || cleanSymbol.endsWith(".NSE")
      ? `For Indian stocks, the symbol ${yahooSymbol} was tried automatically. Markets may be closed or data temporarily unavailable.`
      : `Try symbols like RELIANCE.NSE, TCS.BSE, or AAPL.`;

    return res.status(404).json({
      error: `No intraday data available for ${cleanSymbol}. ${alphaResult.reason ? `Alpha Vantage: ${alphaResult.reason}. ` : ""}${hint}`,
    });
  } catch (error: any) {
    console.error("Error fetching intraday data:", error.message || error);
    return res.status(500).json({ error: error.message || "Internal server error fetching intraday data" });
  }
}

type IntradayPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function normalizePoints(points: IntradayPoint[]): IntradayPoint[] {
  return points
    .filter((q) =>
      q &&
      q.date &&
      Number.isFinite(q.close)
    )
    .map((q) => ({
      ...q,
      open: Number.isFinite(q.open) ? q.open : q.close,
      high: Number.isFinite(q.high) ? q.high : q.close,
      low: Number.isFinite(q.low) ? q.low : q.close,
      volume: Number.isFinite(q.volume) ? q.volume : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function getYahooIntraday(symbol: string): Promise<IntradayPoint[]> {
  try {
    const period2 = new Date();
    const period1 = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
    const result: any = await yahooFinance.chart(
      symbol,
      {
        period1,
        period2,
        interval: "5m" as any,
        includePrePost: true,
      },
      { validateResult: false }
    );

    const quotes = Array.isArray(result?.quotes) ? result.quotes : [];
    const normalized = normalizePoints(
      quotes.map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString() : new Date(q.date).toISOString(),
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume ?? 0),
      }))
    );
    if (normalized.length > 0) return normalized;

    // Fallback: direct Yahoo chart HTTP fetch
    return getYahooChartDirect(symbol);
  } catch (error: any) {
    console.warn(`[intraday] Yahoo intraday failed for ${symbol}:`, error.message || error);
    return [];
  }
}

async function getYahooChartDirect(symbol: string): Promise<IntradayPoint[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=5d&includePrePost=true`;
    const response = await fetch(url);
    if (!response.ok) return [];
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

    return normalizePoints(points);
  } catch (error: any) {
    console.warn(`[intraday] Yahoo direct fetch failed for ${symbol}:`, error.message || error);
    return [];
  }
}

type IntradayFetchResult = {
  data: IntradayPoint[];
  reason?: string;
};

async function getAlphaIntraday(symbol: string, apiKey?: string): Promise<IntradayFetchResult> {
  if (!apiKey) return { data: [], reason: "API key not configured" };

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=full&apikey=${apiKey}`
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
    console.warn(`[intraday] Alpha Vantage intraday failed for ${symbol}:`, error.message || error);
    return { data: [], reason: "request failed" };
  }
}
