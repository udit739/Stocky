#!/usr/bin/env python3
content = open('server.ts','r',encoding='utf-8').read()
insert = '''
// market-overview API
const MARKET_CACHE_TTL = 5 * 60 * 1000;
let marketCache: { data: any; ts: number } | null = null;

app.get("/api/market-overview", async (_req, res) => {
  if (marketCache && Date.now() - marketCache.ts < MARKET_CACHE_TTL) return res.json(marketCache.data);
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
  const indexNames: Record<string,string>     = {"^GSPC":"S\\u0026P 500","^IXIC":"Nasdaq","^DJI":"Dow 30","^RUT":"Russell 2000","^VIX":"VIX","^FTSE":"FTSE 100","^GDAXI":"DAX P","^FCHI":"CAC 40","^STOXX50E":"EURO STOXX 50","^AEX":"AEX","^N225":"Nikkei 225","^HSI":"Hang Seng","000001.SS":"SSE Composite","^BSESN":"S\\u0026P BSE Sensex","^AXJO":"S\\u0026P/ASX 200"};
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
    marketCache = { data: payload, ts: Date.now() };
    res.json(payload);
  } catch(err: any) {
    console.error("[market-overview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

'''
marker = '// API route for historical stock data (Yahoo Finance)\n'
content = content.replace(marker, insert + marker, 1)
open('server.ts','w',encoding='utf-8').write(content)
print('done')
