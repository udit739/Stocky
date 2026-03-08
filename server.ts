import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";
import { calculateRSI, calculateSMA, calculateEMA, calculateMACD } from "./src/utils/technicalAnalysis";

// Allow require() in ESM context for the CJS `arima` package
const require = createRequire(import.meta.url);

function getCurrencySymbol(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith(".BSE") || clean.endsWith(".NSE")) return "₹";
  if (clean.endsWith(".LON")) return "£";
  if (clean.endsWith(".FRA") || clean.endsWith(".GER") || clean.endsWith(".EU")) return "€";
  if (clean.endsWith(".TSX") || clean.endsWith(".TO")) return "C$";
  if (clean.endsWith(".AX")) return "A$";
  if (clean.endsWith(".HK")) return "HK$";
  if (clean.endsWith(".T")) return "¥";
  return "$"; // Default to USD
}

function computeARIMAForecast(prices: number[], steps = 7): number[] {
  try {
    const ARIMA = require("arima");
    const ARIMAClass = ARIMA.default ?? ARIMA;
    const model = new ARIMAClass({ p: 2, d: 1, q: 2, verbose: false });
    model.train(prices);
    const [forecast] = model.predict(steps) as [number[], number[]];
    return (forecast as number[]).map((v: number) => Math.max(0, v));
  } catch (err) {
    console.error("[ARIMA] Forecasting failed:", err);
    return Array(steps).fill(prices[prices.length - 1]);
  }
}

interface PredictionResult {
  trend: "Bullish" | "Bearish" | "Neutral";
  prediction: string;
  confidence: number;
  signal: "Buy" | "Hold" | "Sell";
  explanation: string;
}

function computeTechnicalPrediction(
  data: { close: number; volume: number; rsi: number | null; ma7: number | null; ma20: number | null; ma50: number | null }[],
  arimaForecast: number[]
): PredictionResult {
  const n = data.length;
  if (n < 2) {
    return { trend: "Neutral", signal: "Hold", confidence: 50, prediction: "Insufficient data.", explanation: "Not enough data points to generate a signal." };
  }

  const latest = data[n - 1];
  const closingPrices = data.map(d => d.close);

  let score = 0;
  const bullish: string[] = [];
  const bearish: string[] = [];

  // ── 1. RSI ──────────────────────────────────────────────────────────────
  const rsi = latest.rsi;
  if (rsi !== null) {
    if (rsi < 30) { score += 2; bullish.push(`RSI oversold at ${rsi.toFixed(1)} — strong buy pressure`); }
    else if (rsi < 40) { score += 1; bullish.push(`RSI near oversold at ${rsi.toFixed(1)}`); }
    else if (rsi > 70) { score -= 2; bearish.push(`RSI overbought at ${rsi.toFixed(1)} — potential reversal`); }
    else if (rsi > 60) { score -= 1; bearish.push(`RSI near overbought at ${rsi.toFixed(1)}`); }
    else { bullish.push(`RSI neutral at ${rsi.toFixed(1)}`); }
  }

  // ── 2. MA7 vs MA20 (short-term trend) ────────────────────────────────────
  const { ma7, ma20, ma50 } = latest;
  if (ma7 !== null && ma20 !== null) {
    if (ma7 > ma20) { score += 1; bullish.push("MA7 above MA20 (short-term uptrend)"); }
    else { score -= 1; bearish.push("MA7 below MA20 (short-term downtrend)"); }
  }

  // ── 3. MA20 vs MA50 (medium-term / golden-cross zone) ─────────────────────
  if (ma20 !== null && ma50 !== null) {
    if (ma20 > ma50) { score += 1; bullish.push("MA20 above MA50 (medium-term uptrend)"); }
    else { score -= 1; bearish.push("MA20 below MA50 (medium-term downtrend)"); }
  }

  // ── 4. Price vs MA50 ──────────────────────────────────────────────────────
  if (ma50 !== null) {
    if (latest.close > ma50) { score += 1; bullish.push("Price trading above MA50 support"); }
    else { score -= 1; bearish.push("Price trading below MA50 — bearish territory"); }
  }

  // ── 5. MACD ───────────────────────────────────────────────────────────────
  const macdResult = calculateMACD(closingPrices);
  const latestMACD = macdResult.macd[n - 1];
  const latestSignal = macdResult.signal[n - 1];
  const prevHistogram = macdResult.histogram[n - 2];
  const latestHistogram = macdResult.histogram[n - 1];

  if (latestMACD > latestSignal) {
    score += 2;
    bullish.push(`MACD bullish (MACD ${latestMACD.toFixed(2)} > Signal ${latestSignal.toFixed(2)})`);
    if (latestHistogram > prevHistogram) { score += 1; bullish.push("MACD histogram expanding — momentum building"); }
  } else {
    score -= 2;
    bearish.push(`MACD bearish (MACD ${latestMACD.toFixed(2)} < Signal ${latestSignal.toFixed(2)})`);
    if (latestHistogram < prevHistogram) { score -= 1; bearish.push("MACD histogram widening downward — selling pressure"); }
  }

  // ── 6. ARIMA 7-day forecast ───────────────────────────────────────────────
  if (arimaForecast.length > 0) {
    const forecastEnd = arimaForecast[arimaForecast.length - 1];
    const pct = ((forecastEnd - latest.close) / latest.close) * 100;
    if (pct > 2) { score += 1; bullish.push(`ARIMA projects +${pct.toFixed(1)}% over next 7 days`); }
    else if (pct < -2) { score -= 1; bearish.push(`ARIMA projects ${pct.toFixed(1)}% decline over next 7 days`); }
    else { bullish.push(`ARIMA forecast relatively flat (${pct.toFixed(1)}%)`); }
  }

  // ── 7. Volume trend ───────────────────────────────────────────────────────
  if (n >= 20) {
    const avgVol5 = data.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
    const avgVol20 = data.slice(-20).reduce((s, d) => s + d.volume, 0) / 20;
    const recentPriceChange = latest.close - data[n - 6].close;  // 5-day price change
    if (avgVol5 > avgVol20 * 1.15) {
      if (recentPriceChange > 0) { score += 1; bullish.push("Rising volume confirming upward move"); }
      else { score -= 1; bearish.push("Rising volume on a down move — selling pressure"); }
    }
  }

  // ── Outcome ───────────────────────────────────────────────────────────────
  let trend: PredictionResult["trend"];
  let signal: PredictionResult["signal"];

  if (score >= 3) { trend = "Bullish"; signal = "Buy"; }
  else if (score <= -3) { trend = "Bearish"; signal = "Sell"; }
  else { trend = "Neutral"; signal = "Hold"; }

  const confidence = Math.min(95, 50 + Math.abs(score) * 7);

  const direction = trend === "Bullish" ? "upward" : trend === "Bearish" ? "downward" : "sideways";
  const prediction = `Technical indicators suggest a ${direction} move in the near term. Signal score: ${score > 0 ? "+" : ""}${score}.`;

  let explanation = "";
  if (bullish.length > 0 && bearish.length > 0) {
    explanation = `The stock is currently showing a mixed technical setup. Positive indicators include: ${bullish.join("; ")}. Conversely, bearish signs show: ${bearish.join("; ")}.`;
  } else if (bullish.length > 0) {
    explanation = `The stock is exhibiting strong upward momentum. Positive indicators include: ${bullish.join("; ")}.`;
  } else if (bearish.length > 0) {
    explanation = `The stock is currently facing significant downward pressure. Bearish indicators include: ${bearish.join("; ")}.`;
  } else {
    explanation = "Technical indicators are mostly flat, suggesting a neutral trend with no clear breakout signals.";
  }

  return { trend, signal, confidence, prediction, explanation };
}

// ── Gemini AI Analysis ────────────────────────────────────────────────────────
async function generateAIAnalysis(
  symbol: string,
  latestPrice: number,
  priceChange1d: number,
  priceChange5d: number | null,
  priceChange1m: number | null,
  latestRSI: number | null,
  arimaForecast: number[],
  prediction: PredictionResult,
  currencySymbol: string
): Promise<{ summary: string; reasoning: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const arimaTarget = arimaForecast.length > 0 ? arimaForecast[arimaForecast.length - 1] : null;
    const arimaChangePct = arimaTarget !== null ? ((arimaTarget - latestPrice) / latestPrice * 100).toFixed(2) : "N/A";

    const prompt = `You are a professional stock market analyst. Analyze the following technical data for ${symbol} and provide a concise AI-driven analysis.

Stock: ${symbol}
Current Price: ${currencySymbol}${latestPrice.toFixed(2)}
1-Day Change: ${priceChange1d >= 0 ? '+' : ''}${priceChange1d.toFixed(2)}%
5-Day Change: ${priceChange5d !== null ? (priceChange5d >= 0 ? '+' : '') + priceChange5d.toFixed(2) + '%' : 'N/A'}
1-Month Change: ${priceChange1m !== null ? (priceChange1m >= 0 ? '+' : '') + priceChange1m.toFixed(2) + '%' : 'N/A'}
RSI (14): ${latestRSI !== null ? latestRSI.toFixed(1) : 'N/A'}
ARIMA 7-day Forecast: ${arimaTarget !== null ? currencySymbol + arimaTarget.toFixed(2) + ' (' + arimaChangePct + '%)' : 'N/A'}
Technical Signal: ${prediction.signal} (${prediction.trend})
Confidence Score: ${prediction.confidence}%
Key Signals: ${prediction.explanation}

Respond ONLY with a JSON object in this exact format (no markdown, no code fences):
{
  "summary": "A 2-3 sentence summary of the stock's current situation and short-term outlook, exactly as shown in the mockup under the AI Analysis section.",
  "reasoning": "A 3-4 sentence deeper analysis explaining the key technical factors driving the signal, potential risks, and what to watch for. Keep it flowing like a single paragraph."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "",
      reasoning: parsed.reasoning ?? "",
    };
  } catch (err) {
    console.error("[Gemini] AI analysis failed:", err);
    return null;
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());


// API route for symbol search (Alpha Vantage)
app.get("/api/symbol-search", async (req, res) => {
  const { q } = req.query;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }
  if (!apiKey) {
    return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY is not configured" });
  }

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`
    );
    const data: any = await response.json();

    if (data["Note"] || data["Information"]) {
      return res.json({ bestMatches: [] });
    }

    const matches = (data["bestMatches"] || []).slice(0, 8).map((m: any) => ({
      symbol: m["1. symbol"],
      name: m["2. name"],
      type: m["3. type"],
      region: m["4. region"],
      currency: m["8. currency"],
    }));

    res.json({ bestMatches: matches });
  } catch (error) {
    console.error("Error searching symbols:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API route for Alpha Vantage stock data
app.get("/api/stock-data", async (req, res) => {
  const { symbol } = req.query;
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required and must be a string" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  if (!apiKey) {
    return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY is not configured" });
  }

  try {
    console.log(`[stock-data] Fetching data for: ${cleanSymbol}`);
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${cleanSymbol}&apikey=${apiKey}`
    );
    const data: any = await response.json();

    if (data["Error Message"]) {
      console.error(`[stock-data] Alpha Vantage Error for ${cleanSymbol}:`, data["Error Message"]);
      let errorMessage = `Alpha Vantage Error: Symbol "${cleanSymbol}" not found.`;

      // Add helpful hint for Indian stocks or potentially non-US stocks
      if (!cleanSymbol.includes(".")) {
        errorMessage += ` Try adding an exchange suffix like "${cleanSymbol}.BSE" or "${cleanSymbol}.NSE" for Indian stocks.`;
      }

      return res.status(404).json({ error: errorMessage });
    }

    let timeSeries = data["Time Series (Daily)"];

    if (data["Note"] || data["Information"]) {
      console.warn(`[stock-data] Alpha Vantage rate limit hit for ${cleanSymbol}`);
      return res.status(429).json({
        error: `Alpha Vantage rate limit reached. The free tier allows 25 requests per day and 5 per minute. Please wait a moment and try again.`,
      });
    }

    if (!timeSeries) {
      console.error("Alpha Vantage Response missing Time Series:", data);
      return res.status(500).json({ error: "Failed to fetch time series data. The symbol might be unsupported or API key is invalid." });
    }

    // Extract last 60-100 days
    const dates = Object.keys(timeSeries).slice(0, 100);
    const processedData = dates.map(date => ({
      date,
      open: parseFloat(timeSeries[date]["1. open"]),
      high: parseFloat(timeSeries[date]["2. high"]),
      low: parseFloat(timeSeries[date]["3. low"]),
      close: parseFloat(timeSeries[date]["4. close"]),
      volume: parseInt(timeSeries[date]["5. volume"]),
    })).reverse();

    const closingPrices = processedData.map(d => d.close);
    const { rsiData, latestRSI } = calculateRSI(closingPrices);
    const ma7Data = calculateSMA(closingPrices, 7);
    const ma20Data = calculateSMA(closingPrices, 20);
    const ma50Data = calculateSMA(closingPrices, 50);

    // ARIMA: use at most 60 recent prices for faster/stable fitting
    const arimaInput = closingPrices.slice(-60);
    const arimaForecast = computeARIMAForecast(arimaInput, 7);

    const finalData = processedData.map((d, index) => ({
      ...d,
      rsi: rsiData[index],
      ma7: ma7Data[index],
      ma20: ma20Data[index],
      ma50: ma50Data[index],
    }));

    const prediction = computeTechnicalPrediction(finalData, arimaForecast);

    const latestPriceVal = finalData[finalData.length - 1].close;
    const previousPriceVal = finalData[finalData.length - 2].close;
    const price1d = ((latestPriceVal - previousPriceVal) / previousPriceVal) * 100;
    const price5d = finalData.length >= 6 ? ((latestPriceVal - finalData[finalData.length - 6].close) / finalData[finalData.length - 6].close) * 100 : null;
    const price1m = finalData.length >= 22 ? ((latestPriceVal - finalData[finalData.length - 22].close) / finalData[finalData.length - 22].close) * 100 : null;

    const aiAnalysis = await generateAIAnalysis(
      cleanSymbol,
      latestPriceVal,
      price1d,
      price5d,
      price1m,
      latestRSI,
      arimaForecast,
      prediction,
      getCurrencySymbol(cleanSymbol)
    );

    if (aiAnalysis) {
      prediction.prediction = aiAnalysis.summary;
      prediction.explanation = aiAnalysis.reasoning;
    }

    res.json({
      symbol: cleanSymbol,
      currencySymbol: getCurrencySymbol(cleanSymbol),
      data: finalData,
      latestPrice: latestPriceVal,
      previousPrice: previousPriceVal,
      latestRSI: latestRSI,
      arimaForecast,
      prediction,
    });
  } catch (error) {
    console.error("Error fetching stock data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  (async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  })();
} else {
  app.use(express.static("dist"));
}

// Only start the listener if we're not running as a Vercel serverless function
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;

// ──────────────────────────────────────────────
// End of file
// ──────────────────────────────────────────────
