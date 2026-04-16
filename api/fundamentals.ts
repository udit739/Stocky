import type { VercelRequest, VercelResponse } from "@vercel/node";
import YahooFinance from "yahoo-finance2";
import fetch from "node-fetch";

const yahooFinance = new YahooFinance();

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const cache = new Map<string, { data: any; ts: number }>();

const safeNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "None" || v === "-") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,$%]/g, "").trim());
  return isNaN(n) ? null : n;
};

const safeStr = (v: any): string | null => {
  if (!v || v === "None" || v === "-") return null;
  return String(v).trim() || null;
};

/**
 * Converts Alpha Vantage-style symbol to Yahoo Finance symbol.
 *   TCS.BSE → TCS.BO  |  TCS.NSE → TCS.NS
 */
function toYahooSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith(".BSE")) return upper.replace(/\.BSE$/, ".BO");
  if (upper.endsWith(".NSE")) return upper.replace(/\.NSE$/, ".NS");
  return upper;
}

// ─── Yahoo Finance quoteSummary fetch ─────────────────────────────────────────

async function fetchYahooFundamentals(symbol: string): Promise<any | null> {
  const yahooSym = toYahooSymbol(symbol);

  const modules = [
    "summaryDetail",
    "defaultKeyStatistics",
    "financialData",
    "earnings",
    "earningsTrend",
    "summaryProfile",
    "calendarEvents",
  ] as const;

  try {
    console.log(`[fundamentals] Fetching Yahoo quoteSummary for ${yahooSym}`);
    const result: any = await yahooFinance.quoteSummary(
      yahooSym,
      { modules: modules as any },
      { validateResult: false }
    );
    return result;
  } catch (err: any) {
    console.warn(`[fundamentals] yahoo-finance2 failed for ${yahooSym}:`, err.message || err);
    return null;
  }
}

// ─── Fallback: Yahoo Finance v11 direct HTTP ──────────────────────────────────

async function fetchYahooFundamentalsDirect(symbol: string): Promise<any | null> {
  const yahooSym = toYahooSymbol(symbol);
  const modules = "summaryDetail,defaultKeyStatistics,financialData,earnings,earningsTrend,summaryProfile";

  try {
    const url = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(yahooSym)}?modules=${modules}`;
    console.log(`[fundamentals] Yahoo direct HTTP: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[fundamentals] Yahoo direct HTTP ${response.status} for ${yahooSym}`);
      return null;
    }

    const json: any = await response.json();
    return json?.quoteSummary?.result?.[0] ?? null;
  } catch (err: any) {
    console.warn(`[fundamentals] Yahoo direct failed for ${yahooSym}:`, err.message || err);
    return null;
  }
}

// ─── Build normalized payload from Yahoo data ─────────────────────────────────

function buildPayload(symbol: string, yfData: any): any {
  const sd  = yfData?.summaryDetail    ?? {};
  const dks = yfData?.defaultKeyStatistics ?? {};
  const fd  = yfData?.financialData    ?? {};
  const sp  = yfData?.summaryProfile   ?? {};
  const earn = yfData?.earnings        ?? null;
  const et   = yfData?.earningsTrend   ?? null;

  // ── Trailing Returns ──────────────────────────────────────────────────────
  // earningsTrend sometimes carries no return data; we'll skip if absent
  const trailingReturns = dks?.annualHoldingsTurnover !== undefined
    ? null
    : null; // Yahoo doesn't provide benchmark comparison in free tier, set null

  // ── Earnings Trend ────────────────────────────────────────────────────────
  let earningsTrendPayload: any = null;
  if (et?.trend && Array.isArray(et.trend)) {
    earningsTrendPayload = {
      trend: et.trend.map((t: any) => ({
        period:            t.period ?? null,
        endDate:           t.endDate ?? null,
        growth:            safeNum(t.growth),
        earningsEstimate: {
          avg:  safeNum(t.earningsEstimate?.avg),
          low:  safeNum(t.earningsEstimate?.low),
          high: safeNum(t.earningsEstimate?.high),
        },
        revenueEstimate: {
          avg:  safeNum(t.revenueEstimate?.avg),
          low:  safeNum(t.revenueEstimate?.low),
          high: safeNum(t.revenueEstimate?.high),
        },
      })),
    };
  }

  // ── Earnings Chart ────────────────────────────────────────────────────────
  let earningsPayload: any = null;
  if (earn?.financialsChart) {
    const qtrly = Array.isArray(earn.financialsChart.quarterly)
      ? earn.financialsChart.quarterly.map((q: any) => ({
          date:     q.date ?? null,
          revenue:  safeNum(q.revenue) ?? 0,
          earnings: safeNum(q.earnings) ?? 0,
        }))
      : [];
    const yearly = Array.isArray(earn.financialsChart.yearly)
      ? earn.financialsChart.yearly.map((y: any) => ({
          date:     y.date ?? null,
          revenue:  safeNum(y.revenue) ?? 0,
          earnings: safeNum(y.earnings) ?? 0,
        }))
      : [];
    earningsPayload = { financialsChart: { quarterly: qtrly, yearly } };
  }

  // ── Financial Data ────────────────────────────────────────────────────────
  const financialDataPayload = {
    profitMargins:  safeNum(fd.profitMargins),
    returnOnAssets: safeNum(fd.returnOnAssets),
    returnOnEquity: safeNum(fd.returnOnEquity),
    totalRevenue:   safeNum(fd.totalRevenue),
    totalCash:      safeNum(fd.totalCash),
    debtToEquity:   safeNum(fd.debtToEquity),
    freeCashflow:   safeNum(fd.freeCashflow),
  };

  return {
    // Key Statistics
    peRatio:    safeNum(sd.trailingPE ?? dks.trailingPE),
    forwardPE:  safeNum(sd.forwardPE  ?? dks.forwardPE),
    divYield:   safeNum(sd.dividendYield ?? sd.trailingAnnualDividendYield),
    marketCap:  safeNum(sd.marketCap),
    beta:       safeNum(sd.beta ?? dks.beta),
    eps:        safeNum(dks.trailingEps),
    week52High: safeNum(sd.fiftyTwoWeekHigh),
    week52Low:  safeNum(sd.fiftyTwoWeekLow),
    sector:     safeStr(sp.sector),
    industry:   safeStr(sp.industry),

    // Rich data
    financialData:       financialDataPayload,
    defaultKeyStatistics: {
      netIncomeToCommon: safeNum(dks.netIncomeToCommon),
      trailingEps:       safeNum(dks.trailingEps),
    },
    earnings:       earningsPayload,
    earningsTrend:  earningsTrendPayload,
    trailingReturns: null as any, // populated separately in handler
  };
}

// ─── Trailing Returns (YTD / 1Y / 3Y / 5Y) from Yahoo chart ──────────────────
// Exactly mirrors the logic in server.ts so both environments produce the same data.

async function getTrailingReturns(yahooSym: string): Promise<{
  ytd: number | null;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
} | null> {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 5);
    period1.setDate(period1.getDate() - 7);

    const result: any = await yahooFinance.chart(
      yahooSym,
      { period1, interval: "1mo" as any },
      { validateResult: false }
    );

    const quotes: any[] = Array.isArray(result?.quotes) ? result.quotes : [];
    if (quotes.length === 0) return null;

    const currentPrice: number = quotes[quotes.length - 1].close;
    const currentYear = new Date().getFullYear();

    // YTD: price at end of last year
    const lastYearQuotes = quotes.filter((q: any) => new Date(q.date).getFullYear() < currentYear);
    const ytdStartPrice: number | null = lastYearQuotes.length > 0
      ? lastYearQuotes[lastYearQuotes.length - 1].close
      : null;

    // 1-Year
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const quote1y = quotes.find((q: any) => new Date(q.date) >= oneYearAgo) ?? quotes[quotes.length - 12];
    const price1y: number | null = quote1y?.close ?? null;

    // 3-Year
    const threeYearAgo = new Date();
    threeYearAgo.setFullYear(threeYearAgo.getFullYear() - 3);
    const quote3y = quotes.find((q: any) => new Date(q.date) >= threeYearAgo) ?? quotes[quotes.length - 36];
    const price3y: number | null = quote3y?.close ?? null;

    // 5-Year (oldest available)
    const price5y: number = quotes[0].close;

    const calcReturn = (past: number | null): number | null =>
      past ? ((currentPrice - past) / past) * 100 : null;

    return {
      ytd:       calcReturn(ytdStartPrice),
      oneYear:   calcReturn(price1y),
      threeYear: calcReturn(price3y),
      fiveYear:  calcReturn(price5y),
    };
  } catch (err: any) {
    console.warn(`[fundamentals] getTrailingReturns failed for ${yahooSym}:`, err.message || err);
    return null;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol || typeof symbol !== "string") {
    return res.status(400).json({ error: "Symbol required" });
  }

  const sym = symbol.trim().toUpperCase();

  // ── Serve from cache if fresh ────────────────────────────────────────────
  const cached = cache.get(sym);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[fundamentals] Cache HIT for ${sym}`);
    return res.json(cached.data);
  }

  try {
    const yahooSym = toYahooSymbol(sym);

    // ── Fetch quoteSummary + trailing returns in parallel ─────────────────
    const [raw, stockReturns, sp500Returns] = await Promise.all([
      fetchYahooFundamentals(sym).then(r => r ?? fetchYahooFundamentalsDirect(sym)),
      getTrailingReturns(yahooSym),
      getTrailingReturns("^GSPC"),
    ]);

    if (!raw) {
      return res.status(404).json({
        error: `Could not fetch fundamentals for ${sym}. Yahoo Finance may be temporarily unavailable.`,
      });
    }

    const payload = buildPayload(sym, raw);
    payload.trailingReturns = { stock: stockReturns, sp500: sp500Returns };

    cache.set(sym, { data: payload, ts: Date.now() });
    console.log(`[fundamentals] OK for ${sym}: PE=${payload.peRatio}, MCap=${payload.marketCap}, trailingReturns=${stockReturns ? 'yes' : 'null'}`);
    return res.json(payload);
  } catch (err: any) {
    console.error("[fundamentals] Unexpected error:", err.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
