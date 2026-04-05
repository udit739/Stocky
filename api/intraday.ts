import type { VercelRequest, VercelResponse } from "@vercel/node";
import YahooFinance from "yahoo-finance2";
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
    
    // Using yahoo-finance2 to get intraday chart.
    // Interval '2m' or '5m' with range '1d' covers the latest trading day nicely without overwhelming.
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const result: any = await yahooFinance.chart(cleanSymbol, {
      period1: new Date(Date.now() - 24 * 60 * 60 * 1000 * 3),
      interval: "5m"
    }, { validateResult: false });

    if (!result || !result.quotes || result.quotes.length === 0) {
        return res.status(404).json({ error: `Intraday data not found for ${cleanSymbol}` });
    }

    const allQuotes = result.quotes.map((q: any) => ({
        date: q.date.toISOString(),
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        volume: q.volume
    })).filter((q: any) => q.close !== null && q.close !== undefined);

    if (allQuotes.length === 0) {
      return res.status(404).json({ error: `No intraday data found for ${cleanSymbol}` });
    }

    // Filter to only the most recent trading day
    const lastDayStr = allQuotes[allQuotes.length - 1].date.split('T')[0];
    const data = allQuotes.filter((q: any) => q.date.startsWith(lastDayStr));

    return res.json({
      symbol: cleanSymbol,
      currencySymbol: getCurrencySymbol(cleanSymbol),
      data,
      tradingDay: lastDayStr
    });
  } catch (error: any) {
    console.error("Error fetching intraday data:", error.message || error);
    return res.status(500).json({ error: error.message || "Internal server error fetching intraday data" });
  }
}
