import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

// ── Technical Analysis Functions (inlined for serverless) ──

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  let seed = 0;
  const start = Math.min(period, prices.length);
  for (let i = 0; i < start; i++) seed += prices[i];
  seed /= start;
  const ema: number[] = new Array(prices.length).fill(0);
  ema[start - 1] = seed;
  for (let i = start; i < prices.length; i++) {
    ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
  }
  for (let i = 0; i < start - 1; i++) {
    ema[i] = ema[start - 1];
  }
  return ema;
}

function calculateMACD(prices: number[]) {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = prices.map((_, i) => ema12[i] - ema26[i]);
  const signal = calculateEMA(macd, 9);
  const histogram = macd.map((v, i) => v - signal[i]);
  return { macd, signal, histogram };
}

function calculateRSI(closingPrices: number[], period: number = 14) {
  if (closingPrices.length < period + 1) {
    return { rsiData: new Array(closingPrices.length).fill(null), latestRSI: null };
  }
  const rsiData: (number | null)[] = new Array(period).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closingPrices[i] - closingPrices[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  let rs = avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  rsiData.push(rsi);
  for (let i = period + 1; i < closingPrices.length; i++) {
    const change = closingPrices[i] - closingPrices[i - 1];
    let gain = 0, loss = 0;
    if (change > 0) gain = change;
    else loss = Math.abs(change);
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    rs = avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    rsiData.push(rsi);
  }
  const firstValidRSI = rsiData[period];
  for (let i = 0; i < period; i++) rsiData[i] = firstValidRSI;
  return { rsiData: rsiData as number[], latestRSI: rsiData[rsiData.length - 1] as number };
}

function calculateSMA(closingPrices: number[], period: number): (number | null)[] {
  if (closingPrices.length < period) return new Array(closingPrices.length).fill(null);
  const smaData: (number | null)[] = new Array(period - 1).fill(null);
  for (let i = period - 1; i < closingPrices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closingPrices[i - j];
    smaData.push(sum / period);
  }
  const firstValidSMA = smaData[period - 1];
  for (let i = 0; i < period - 1; i++) smaData[i] = firstValidSMA;
  return smaData;
}

// ── Helper Functions ──

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

function computeARIMAForecast(prices: number[], steps = 7): number[] {
  try {
    const ARIMA = require("arima");
    const ARIMAClass = ARIMA.default ?? ARIMA;
    const model = new ARIMAClass({ p: 2, d: 1, q: 2, verbose: false });
    model.train(prices);
    const [forecast] = model.predict(steps) as [number[], number[]];
    return (forecast as number[]).map((v: number) => Math.max(0, v));
  } catch (err) {
    console.error("[ARIMA] Forecasting failed, using simple fallback:", err);
    // Simple linear extrapolation fallback
    const lastPrice = prices[prices.length - 1];
    const secondLast = prices[prices.length - 2] || lastPrice;
    const dailyChange = lastPrice - secondLast;
    return Array.from({ length: steps }, (_, i) => Math.max(0, lastPrice + dailyChange * (i + 1)));
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
    return { trend: "Neutral", signal: "Hold", confidence: 50, prediction: "Insufficient data.", explanation: "Not enough data points." };
  }
  const latest = data[n - 1];
  const closingPrices = data.map(d => d.close);
  let score = 0;
  const bullish: string[] = [];
  const bearish: string[] = [];

  const rsi = latest.rsi;
  if (rsi !== null) {
    if (rsi < 30) { score += 2; bullish.push(`RSI oversold at ${rsi.toFixed(1)}`); }
    else if (rsi < 40) { score += 1; bullish.push(`RSI near oversold at ${rsi.toFixed(1)}`); }
    else if (rsi > 70) { score -= 2; bearish.push(`RSI overbought at ${rsi.toFixed(1)}`); }
    else if (rsi > 60) { score -= 1; bearish.push(`RSI near overbought at ${rsi.toFixed(1)}`); }
    else { bullish.push(`RSI neutral at ${rsi.toFixed(1)}`); }
  }

  const { ma7, ma20, ma50 } = latest;
  if (ma7 !== null && ma20 !== null) {
    if (ma7 > ma20) { score += 1; bullish.push("MA7 above MA20"); } else { score -= 1; bearish.push("MA7 below MA20"); }
  }
  if (ma20 !== null && ma50 !== null) {
    if (ma20 > ma50) { score += 1; bullish.push("MA20 above MA50"); } else { score -= 1; bearish.push("MA20 below MA50"); }
  }
  if (ma50 !== null) {
    if (latest.close > ma50) { score += 1; bullish.push("Price above MA50"); } else { score -= 1; bearish.push("Price below MA50"); }
  }

  const macdResult = calculateMACD(closingPrices);
  const latestMACD = macdResult.macd[n - 1];
  const latestSignalVal = macdResult.signal[n - 1];
  const prevHistogram = macdResult.histogram[n - 2];
  const latestHistogram = macdResult.histogram[n - 1];

  if (latestMACD > latestSignalVal) {
    score += 2; bullish.push(`MACD bullish`);
    if (latestHistogram > prevHistogram) { score += 1; bullish.push("MACD momentum building"); }
  } else {
    score -= 2; bearish.push(`MACD bearish`);
    if (latestHistogram < prevHistogram) { score -= 1; bearish.push("MACD selling pressure"); }
  }

  if (arimaForecast.length > 0) {
    const forecastEnd = arimaForecast[arimaForecast.length - 1];
    const pct = ((forecastEnd - latest.close) / latest.close) * 100;
    if (pct > 2) { score += 1; bullish.push(`ARIMA projects +${pct.toFixed(1)}%`); }
    else if (pct < -2) { score -= 1; bearish.push(`ARIMA projects ${pct.toFixed(1)}%`); }
    else { bullish.push(`ARIMA flat (${pct.toFixed(1)}%)`); }
  }

  if (n >= 20) {
    const avgVol5 = data.slice(-5).reduce((s, d) => s + d.volume, 0) / 5;
    const avgVol20 = data.slice(-20).reduce((s, d) => s + d.volume, 0) / 20;
    const recentPriceChange = latest.close - data[n - 6].close;
    if (avgVol5 > avgVol20 * 1.15) {
      if (recentPriceChange > 0) { score += 1; bullish.push("Rising volume on upward move"); }
      else { score -= 1; bearish.push("Rising volume on down move"); }
    }
  }

  let trend: PredictionResult["trend"];
  let signal: PredictionResult["signal"];
  if (score >= 3) { trend = "Bullish"; signal = "Buy"; }
  else if (score <= -3) { trend = "Bearish"; signal = "Sell"; }
  else { trend = "Neutral"; signal = "Hold"; }

  const confidence = Math.min(95, 50 + Math.abs(score) * 7);
  const direction = trend === "Bullish" ? "upward" : trend === "Bearish" ? "downward" : "sideways";
  const prediction = `Technical indicators suggest a ${direction} move. Signal score: ${score > 0 ? "+" : ""}${score}.`;

  let explanation = "";
  if (bullish.length > 0 && bearish.length > 0) {
    explanation = `Mixed setup. Bullish: ${bullish.join("; ")}. Bearish: ${bearish.join("; ")}.`;
  } else if (bullish.length > 0) {
    explanation = `Strong upward momentum. ${bullish.join("; ")}.`;
  } else if (bearish.length > 0) {
    explanation = `Downward pressure. ${bearish.join("; ")}.`;
  } else {
    explanation = "Indicators flat, no clear breakout signals.";
  }

  return { trend, signal, confidence, prediction, explanation };
}

async function generateAIAnalysis(
  symbol: string, latestPrice: number, priceChange1d: number,
  priceChange5d: number | null, priceChange1m: number | null,
  latestRSI: number | null, arimaForecast: number[],
  prediction: PredictionResult, currencySymbol: string
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
  "summary": "A 2-3 sentence summary of the stock's current situation and short-term outlook.",
  "reasoning": "A 3-4 sentence deeper analysis explaining the key technical factors driving the signal, potential risks, and what to watch for."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text?.trim() ?? "";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return { summary: parsed.summary ?? "", reasoning: parsed.reasoning ?? "" };
  } catch (err) {
    console.error("[Gemini] AI analysis failed:", err);
    return null;
  }
}

// ── Main Handler ──

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
    return res.status(400).json({ error: "Symbol is required and must be a string" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  if (!apiKey) {
    return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY is not configured. Please add it in Vercel Environment Variables." });
  }

  try {
    console.log(`[stock-data] Fetching data for: ${cleanSymbol}`);
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${cleanSymbol}&apikey=${apiKey}`
    );
    const data: any = await response.json();

    if (data["Error Message"]) {
      let errorMessage = `Symbol "${cleanSymbol}" not found.`;
      if (!cleanSymbol.includes(".")) {
        errorMessage += ` Try "${cleanSymbol}.BSE" or "${cleanSymbol}.NSE" for Indian stocks.`;
      }
      return res.status(404).json({ error: errorMessage });
    }

    if (data["Note"] || data["Information"]) {
      return res.status(429).json({ error: "Alpha Vantage rate limit reached. Please wait and try again." });
    }

    const timeSeries = data["Time Series (Daily)"];
    if (!timeSeries) {
      return res.status(500).json({ error: "Failed to fetch time series data." });
    }

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
      cleanSymbol, latestPriceVal, price1d, price5d, price1m,
      latestRSI, arimaForecast, prediction, getCurrencySymbol(cleanSymbol)
    );

    if (aiAnalysis) {
      prediction.prediction = aiAnalysis.summary;
      prediction.explanation = aiAnalysis.reasoning;
    }

    return res.json({
      symbol: cleanSymbol,
      currencySymbol: getCurrencySymbol(cleanSymbol),
      data: finalData,
      latestPrice: latestPriceVal,
      previousPrice: previousPriceVal,
      latestRSI,
      arimaForecast,
      prediction,
    });
  } catch (error: any) {
    console.error("Error fetching stock data:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
