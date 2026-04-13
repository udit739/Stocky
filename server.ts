import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createRequire } from "module";
import { GoogleGenAI } from "@google/genai";
import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

const INTRADAY_CACHE_TTL_MS = 60 * 1000;
const intradayCache = new Map<string, { data: IntradayPoint[]; ts: number }>();
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


// API route for symbol search (Yahoo Finance)
app.get("/api/symbol-search", async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    const searchResult = await yahooFinance.search(q);
    const matches = (searchResult.quotes || [])
      .filter((q: any) => q.isYahooFinance)
      .slice(0, 8)
      .map((m: any) => ({
        symbol: m.symbol,
        name: m.shortname || m.longname || m.symbol,
        type: m.quoteType || "EQUITY",
        region: m.exchDisp || "US",
        currency: "USD",
      }));

    res.json({ bestMatches: matches });
  } catch (error) {
    console.error("Error searching symbols via Yahoo:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// market-overview API
const MARKET_CACHE_TTL = 5 * 60 * 1000;
let marketCache: { data: any; ts: number } | null = null;

app.get("/api/market-overview", async (req, res) => {
  const nocache = req.query.nocache === "1";
  if (!nocache && marketCache && Date.now() - marketCache.ts < MARKET_CACHE_TTL) {
    return res.json(marketCache.data);
  }
  const worldSymbols = {
    americas: ["^GSPC","^IXIC","^DJI","^RUT","^VIX"],
    europe: ["^FTSE","^GDAXI","^FCHI","^STOXX50E","^AEX"],
    asia: ["^N225","^HSI","000001.SS","^BSESN","^AXJO"]
  };
  const sectorDefs = [
    {name:"Technology",etf:"XLK",weight:28.46},
    {name:"Financial Services",etf:"XLF",weight:14.11},
    {name:"Consumer Cyclical",etf:"XLY",weight:10.18},
    {name:"Communication Services",etf:"XLC",weight:9.94},
    {name:"Healthcare",etf:"XLV",weight:9.56},
    {name:"Industrials",etf:"XLI",weight:9.38},
    {name:"Energy",etf:"XLE",weight:5.44},
    {name:"Consumer Defensive",etf:"XLP",weight:5.15},
    {name:"Basic Materials",etf:"XLB",weight:3.11},
    {name:"Utilities",etf:"XLU",weight:2.41},
    {name:"Real Estate",etf:"XLRE",weight:2.26}
  ];
  const commoditySyms = ["GC=F","SI=F","CL=F","BZ=F","HG=F","NG=F","PL=F"];
  const currencySyms  = ["EURUSD=X","USDJPY=X","USDHKD=X","USDCAD=X","GBPUSD=X","USDMXN=X","AUDUSD=X"];
  const bondSyms      = ["^TNX","^TYX","^IRX","^FVX"];
  const commodityNames: Record<string,string> = {"GC=F":"Gold","SI=F":"Silver","CL=F":"Crude Oil","BZ=F":"Brent Crude","HG=F":"Copper","NG=F":"Natural Gas","PL=F":"Platinum"};
  const currencyNames: Record<string,string>  = {"EURUSD=X":"EUR/USD","USDJPY=X":"USD/JPY","USDHKD=X":"USD/HKD","USDCAD=X":"USD/CAD","GBPUSD=X":"GBP/USD","USDMXN=X":"USD/MXN","AUDUSD=X":"AUD/USD"};
  const bondNames: Record<string,string>      = {"^TNX":"10-Yr T-Note","^TYX":"30-Yr Bond","^IRX":"13-Wk T-Bill","^FVX":"5-Yr Bond"};
  const indexNames: Record<string,string>     = {"^GSPC":"S\u0026P 500","^IXIC":"Nasdaq","^DJI":"Dow 30","^RUT":"Russell 2000","^VIX":"VIX","^FTSE":"FTSE 100","^GDAXI":"DAX P","^FCHI":"CAC 40","^STOXX50E":"EURO STOXX 50","^AEX":"AEX","^N225":"Nikkei 225","^HSI":"Hang Seng","000001.SS":"SSE Composite","^BSESN":"S\u0026P BSE Sensex","^AXJO":"S\u0026P/ASX 200"};
  const fmt = (q: any, nm?: Record<string,string>) => ({ symbol: q.symbol, name: (nm && nm[q.symbol]) || q.shortName || q.longName || q.symbol, price: q.regularMarketPrice ?? null, change: q.regularMarketChange ?? null, changePct: q.regularMarketChangePercent ?? null });
  try {
    const all = [...worldSymbols.americas,...worldSymbols.europe,...worldSymbols.asia,...commoditySyms,...currencySyms,...bondSyms,...sectorDefs.map(s=>s.etf)];
    const raw: any = await yahooFinance.quote(all as any);
    const arr: any[] = Array.isArray(raw) ? raw : [raw];
    const by: Record<string,any> = {};
    for (const q of arr) by[q.symbol] = q;
    const pick = (syms: string[], nm?: Record<string,string>) => syms.map(s=>by[s] ? fmt(by[s],nm) : null).filter(Boolean);
    const sectors = sectorDefs.map(s=>({ name:s.name, etf:s.etf, weight:s.weight, changePct: by[s.etf]?.regularMarketChangePercent ?? null, price: by[s.etf]?.regularMarketPrice ?? null }));
    const payload = {
      worldIndices: { americas: pick(worldSymbols.americas,indexNames), europe: pick(worldSymbols.europe,indexNames), asia: pick(worldSymbols.asia,indexNames) },
      commodities: pick(commoditySyms,commodityNames), currencies: pick(currencySyms,currencyNames), bonds: pick(bondSyms,bondNames), sectors
    };
    payload.updatedAt = new Date().toISOString();
    marketCache = { data: payload, ts: Date.now() };
    res.json(payload);
  } catch(err: any) {
    console.error("[market-overview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// API route for historical stock data (Yahoo Finance)
app.get("/api/stock-data", async (req, res) => {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required and must be a string" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  const yahooSym = cleanSymbol.replace(".NSE", ".NS").replace(".BSE", ".BO");

  try {
    console.log(`[stock-data] Fetching historical data for: ${cleanSymbol} (mapped as ${yahooSym})`);
    
    // Fetch roughly 150 days of data to fulfill technical indicators array size needs
    const period1 = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
    const result: any = await yahooFinance.chart(yahooSym, { period1, interval: '1d' }, { validateResult: false });
    
    if (!result || !result.quotes || result.quotes.length === 0) {
      return res.status(404).json({ error: `Yahoo Finance Error: Symbol "${cleanSymbol}" not found or no historical data available.` });
    }

    const quotes = result.quotes.filter((q: any) => q.close !== null && q.close !== undefined);
    
    // Extract last 100 days maximum as expected by frontend
    const extractedData = quotes.slice(-100);
    
    const processedData = extractedData.map((d: any) => ({
      date: typeof d.date === 'string' ? d.date.split('T')[0] : new Date(d.date).toISOString().split('T')[0],
      open: parseFloat(d.open),
      high: parseFloat(d.high),
      low: parseFloat(d.low),
      close: parseFloat(d.close),
      volume: parseInt(d.volume || 0),
    }));

    const closingPrices = processedData.map((d: any) => d.close);
    const { rsiData, latestRSI } = calculateRSI(closingPrices);
    const ma7Data = calculateSMA(closingPrices, 7);
    const ma20Data = calculateSMA(closingPrices, 20);
    const ma50Data = calculateSMA(closingPrices, 50);

    // ARIMA: use at most 60 recent prices for faster/stable fitting
    const arimaInput = closingPrices.slice(-60);
    const arimaForecast = computeARIMAForecast(arimaInput, 7);

    const finalData = processedData.map((d: any, index: any) => ({
      ...d,
      rsi: rsiData[index],
      ma7: ma7Data[index],
      ma20: ma20Data[index],
      ma50: ma50Data[index],
    }));

    const prediction = computeTechnicalPrediction(finalData, arimaForecast);

    const latestPriceVal = finalData[finalData.length - 1].close;
    const previousPriceVal = finalData[finalData.length - 2]?.close || latestPriceVal;
    
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
    console.error("Error fetching historical stock data via Yahoo:", error);
    res.status(500).json({ error: "Failed to fetch historical data. Symbol might be invalid." });
  }
});

// ── 24h cache for AV OVERVIEW fundamentals ───────────────────────────────────
const OVERVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const overviewCache = new Map<string, { data: any; ts: number }>();

const safeNum = (v: string | undefined): number | null => {
  if (!v || v === "None" || v === "-" || v.trim() === "") return null;
  const n = parseFloat(v.replace(/[,$%]/g, "").trim());
  return isNaN(n) ? null : n;
};

// ── Dedicated endpoint: Yahoo Finance fundamentals (cached 24h) ────────────────
app.get("/api/fundamentals", async (req, res) => {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== "string") return res.status(400).json({ error: "Symbol required" });

  const sym = symbol.trim().toUpperCase();

  // Serve from cache if fresh
  const cached = overviewCache.get(sym);
  if (cached && Date.now() - cached.ts < OVERVIEW_CACHE_TTL_MS) {
    console.log(`[fundamentals] Cache HIT for ${sym}`);
    return res.json(cached.data);
  }

  try {
    console.log(`[fundamentals] Fetching OVERVIEW from Yahoo for ${sym}`);
    
    let payload = {
      peRatio: null as number | null,
      forwardPE: null as number | null,
      divYield: null as number | null,
      marketCap: null as number | null,
      beta: null as number | null,
      eps: null as number | null,
      week52High: null as number | null,
      week52Low: null as number | null,
      sector: null as string | null,
      industry: null as string | null,
      earnings: null as any,
      earningsTrend: null as any,
      financialData: null as any,
      defaultKeyStatistics: null as any,
      rateLimited: false
    };

    const yahooSym = sym.replace(".NSE", ".NS").replace(".BSE", ".BO");

    const yf = await yahooFinance.quoteSummary(yahooSym, {
      modules: ['summaryDetail', 'defaultKeyStatistics', 'assetProfile', 'earnings', 'earningsTrend', 'financialData']
    }) as any;

    if (yf.summaryDetail) {
      payload.peRatio = payload.peRatio ?? yf.summaryDetail.trailingPE ?? null;
      payload.forwardPE = payload.forwardPE ?? yf.summaryDetail.forwardPE ?? null;
      payload.divYield = payload.divYield ?? yf.summaryDetail.dividendYield ?? null;
      payload.marketCap = payload.marketCap ?? yf.summaryDetail.marketCap ?? null;
      payload.beta = payload.beta ?? yf.summaryDetail.beta ?? null;
      payload.week52High = payload.week52High ?? yf.summaryDetail.fiftyTwoWeekHigh ?? null;
      payload.week52Low = payload.week52Low ?? yf.summaryDetail.fiftyTwoWeekLow ?? null;
    }
    if (yf.defaultKeyStatistics) {
      payload.eps = payload.eps ?? yf.defaultKeyStatistics.trailingEps ?? null;
      payload.defaultKeyStatistics = yf.defaultKeyStatistics;
    }
    if (yf.assetProfile) {
      payload.sector = payload.sector ?? yf.assetProfile.sector ?? null;
      payload.industry = payload.industry ?? yf.assetProfile.industry ?? null;
    }
    if (yf.earnings) {
      payload.earnings = yf.earnings;
    }
    if (yf.earningsTrend) {
      payload.earningsTrend = yf.earningsTrend;
    }
    if (yf.financialData) {
      payload.financialData = yf.financialData;
    }

    // -- Calculate Trailing Returns natively via 5-year chart (Monthly interval)
    async function getTrailingReturns(stockSymbol: string) {
      try {
        const period1 = new Date();
        period1.setFullYear(period1.getFullYear() - 5);
        period1.setDate(period1.getDate() - 7);

        const res: any = await yahooFinance.chart(stockSymbol, { period1, interval: '1mo' }, { validateResult: false });
        const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
        if (quotes.length === 0) return null;

        const currentPrice = quotes[quotes.length - 1].close;
        const currentYear = new Date().getFullYear();
        const lastYearQuotes = quotes.filter((q: any) => new Date(q.date).getFullYear() < currentYear);
        const ytdStartPrice = lastYearQuotes.length > 0 ? lastYearQuotes[lastYearQuotes.length - 1].close : null;

        const oneYearAgoDate = new Date();
        oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
        const quote1y = quotes.find((q: any) => new Date(q.date) >= oneYearAgoDate) || quotes[quotes.length - 12];
        const price1y = quote1y ? quote1y.close : null;

        const threeYearAgoDate = new Date();
        threeYearAgoDate.setFullYear(threeYearAgoDate.getFullYear() - 3);
        const quote3y = quotes.find((q: any) => new Date(q.date) >= threeYearAgoDate) || quotes[quotes.length - 36];
        const price3y = quote3y ? quote3y.close : null;

        const price5y = quotes[0].close;

        const calcReturn = (past: number | null) => past ? ((currentPrice - past) / past) * 100 : null;

        return {
          ytd: calcReturn(ytdStartPrice),
          oneYear: calcReturn(price1y),
          threeYear: calcReturn(price3y),
          fiveYear: calcReturn(price5y),
        };
      } catch (err) {
        return null;
      }
    }

    const [stockReturns, sp500Returns] = await Promise.all([
      getTrailingReturns(yahooSym),
      getTrailingReturns('^GSPC')
    ]);

    (payload as any).trailingReturns = {
      stock: stockReturns,
      sp500: sp500Returns
    };

    console.log(`[fundamentals] OK for ${sym}: PE=${payload.peRatio}, MCap=${payload.marketCap}, EPS=${payload.eps}`);
    overviewCache.set(sym, { data: payload, ts: Date.now() });
    res.json(payload);
  } catch (err: any) {
    console.warn(`[fundamentals] Error fetching for ${sym}:`, err.message || err);
    res.status(500).json({ error: "Internal server error fetching fundamentals" });
  }
});

// ── /api/realtime-quote — live price only (Yahoo Finance Quote) ─────────────────────
app.get("/api/realtime-quote", async (req, res) => {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== "string") return res.status(400).json({ error: "Symbol is required" });

  const cleanSymbol = symbol.trim().toUpperCase();
  const yahooSym = cleanSymbol.replace(".NSE", ".NS").replace(".BSE", ".BO");

  try {
    console.log(`[realtime-quote] Fetching Yahoo Quote for: ${cleanSymbol} (mapped as ${yahooSym})`);
    const q = await yahooFinance.quote(yahooSym);
    
    if (!q || !q.regularMarketPrice) {
      return res.status(404).json({ error: `No live quote available for "${cleanSymbol}".` });
    }

    const price = q.regularMarketPrice;
    const volume = q.regularMarketVolume || 0;

    res.json({
      symbol: q.symbol || cleanSymbol,
      currencySymbol: getCurrencySymbol(cleanSymbol),
      price,
      open: q.regularMarketOpen || price,
      high: q.regularMarketDayHigh || price,
      low: q.regularMarketDayLow || price,
      previousClose: q.regularMarketPreviousClose || price,
      change: q.regularMarketChange || 0,
      changePercent: q.regularMarketChangePercent?.toFixed(4) ?? "0",
      volume,
      latestTradingDay: (q.regularMarketTime ? new Date(q.regularMarketTime).toISOString().split('T')[0] : ""),
      liquidity: price * volume,
    });
  } catch (error) {
    console.error("Error fetching realtime quote via Yahoo:", error);
    res.status(500).json({ error: "Internal server error fetching live quote" });
  }
});

// ── /api/intraday — intraday chart data using yahoo-finance2 ─────────────────
app.get("/api/intraday", async (req, res) => {
  const { symbol } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol is required" });
  }

  const cleanSymbol = symbol.trim().toUpperCase();
  const yahooSym = cleanSymbol.replace(".NSE", ".NS").replace(".BSE", ".BO");

  try {
    console.log(`[intraday] Fetching 1D chart for: ${cleanSymbol} (mapped as ${yahooSym})`);

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

    const yahooData = await getYahooIntraday(yahooSym);
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

    return res.status(404).json({
      error: `No intraday data available for ${cleanSymbol}. Try a Yahoo-format symbol such as RELIANCE.NS, TCS.NS, or AAPL.`,
    });
  } catch (error: any) {
    console.error("[intraday] Error:", error.message || error);
    console.error("[intraday] Stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal server error fetching intraday data" });
  }
});

type IntradayPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function normalizeIntradayPoints(points: IntradayPoint[]): IntradayPoint[] {
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
    const period1 = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
    const rangeResult: any = await yahooFinance.chart(
      symbol,
      {
        period1,
        period2,
        interval: "5m",
        includePrePost: true,
      },
      { validateResult: false }
    );
    const rangeQuotes = Array.isArray(rangeResult?.quotes) ? rangeResult.quotes : [];
    const rangeNormalized = normalizeIntradayPoints(
      rangeQuotes.map((q: any) => ({
        date: q.date instanceof Date ? q.date.toISOString() : new Date(q.date).toISOString(),
        open: Number(q.open),
        high: Number(q.high),
        low: Number(q.low),
        close: Number(q.close),
        volume: Number(q.volume ?? 0),
      }))
    );
    if (rangeNormalized.length > 0) return rangeNormalized;

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

    return normalizeIntradayPoints(points);
  } catch (error: any) {
    console.warn(`[intraday] Yahoo direct fetch failed for ${symbol}:`, error.message || error);
    return [];
  }
}


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
