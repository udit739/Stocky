import type { VercelRequest, VercelResponse } from "@vercel/node";
import YahooFinance from "yahoo-finance2";
import fetch from "node-fetch";
const yahooFinance = new YahooFinance();

function getCurrencySymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith(".BSE") || clean.endsWith(".NSE")) return "₹";
  if (clean.endsWith(".LON")) return "£";
  if (clean.endsWith(".FRA") || clean.endsWith(".GER") || clean.endsWith(".EU")) return "€";
  if (clean.endsWith(".TSX") || clean.endsWith(".TO")) return "C$";
  if (clean.endsWith(".AX")) return "A$";
  if (clean.endsWith(".HK")) return "HK$";
  if (clean.endsWith(".T")) return "¥";
  return "$";
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

    const yahooData = await getYahooIntraday(cleanSymbol);
    if (yahooData.length > 0) {
      const lastDayStr = yahooData[yahooData.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: yahooData.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "yahoo",
      });
    }

    const alphaData = await getAlphaIntraday(cleanSymbol, process.env.ALPHA_VANTAGE_API_KEY);
    if (alphaData.length > 0) {
      const lastDayStr = alphaData[alphaData.length - 1].date.split("T")[0];
      return res.json({
        symbol: cleanSymbol,
        currencySymbol: getCurrencySymbol(cleanSymbol),
        data: alphaData.filter((q) => q.date.startsWith(lastDayStr)),
        tradingDay: lastDayStr,
        source: "alpha-vantage",
      });
    }

    return res.status(404).json({
      error: `No intraday data available for ${cleanSymbol}. Try a Yahoo-format symbol such as RELIANCE.NS, TCS.NS, or AAPL.`,
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
      Number.isFinite(q.open) &&
      Number.isFinite(q.high) &&
      Number.isFinite(q.low) &&
      Number.isFinite(q.close)
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function getYahooIntraday(symbol: string): Promise<IntradayPoint[]> {
  try {
    const result: any = await yahooFinance.chart(
      symbol,
      {
        range: "5d",
        interval: "5m",
        includePrePost: false,
      },
      { validateResult: false }
    );

    const quotes = Array.isArray(result?.quotes) ? result.quotes : [];
    return normalizePoints(
      quotes.map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString() : new Date(q.date).toISOString(),
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume ?? 0),
      }))
    );
  } catch (error: any) {
    console.warn(`[intraday] Yahoo intraday failed for ${symbol}:`, error.message || error);
    return [];
  }
}

async function getAlphaIntraday(symbol: string, apiKey?: string): Promise<IntradayPoint[]> {
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${encodeURIComponent(symbol)}&interval=5min&outputsize=full&apikey=${apiKey}`
    );
    const payload: any = await response.json();

    if (payload?.Note || payload?.Information || payload?.ErrorMessage) {
      return [];
    }

    const series = payload?.["Time Series (5min)"];
    if (!series || typeof series !== "object") return [];

    return normalizePoints(
      Object.entries(series).map(([timestamp, values]: [string, any]) => ({
        date: new Date(timestamp.replace(" ", "T")).toISOString(),
        open: Number(values["1. open"]),
        high: Number(values["2. high"]),
        low: Number(values["3. low"]),
        close: Number(values["4. close"]),
        volume: Number(values["5. volume"] ?? 0),
      }))
    );
  } catch (error: any) {
    console.warn(`[intraday] Alpha Vantage intraday failed for ${symbol}:`, error.message || error);
    return [];
  }
}
