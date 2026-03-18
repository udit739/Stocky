import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";

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
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required" });
  }
  if (!apiKey) {
    return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY is not configured" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  try {
    console.log(`[realtime-quote] Fetching GLOBAL_QUOTE for: ${cleanSymbol}`);
    const quoteRes = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${cleanSymbol}&apikey=${apiKey}`
    );
    const quoteData: any = await quoteRes.json();

    if (quoteData["Note"] || quoteData["Information"]) {
      return res.status(429).json({ error: "Alpha Vantage rate limit reached. Please wait a moment and try again." });
    }

    const q = quoteData["Global Quote"];
    if (!q || !q["05. price"]) {
      return res.status(404).json({ error: `No live quote available for "${cleanSymbol}".` });
    }

    const price  = parseFloat(q["05. price"]);
    const volume = parseInt(q["06. volume"]);

    return res.json({
      symbol:           q["01. symbol"] || cleanSymbol,
      currencySymbol:   getCurrencySymbol(cleanSymbol),
      price,
      open:             parseFloat(q["02. open"]),
      high:             parseFloat(q["03. high"]),
      low:              parseFloat(q["04. low"]),
      previousClose:    parseFloat(q["08. previous close"]),
      change:           parseFloat(q["09. change"]),
      changePercent:    q["10. change percent"]?.replace("%", "") ?? "0",
      volume,
      latestTradingDay: q["07. latest trading day"] || "",
      liquidity:        price * volume,
    });
  } catch (error) {
    console.error("Error fetching realtime quote:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
