content = open('server.ts','r',encoding='utf-8').read()
old = 'app.get("/api/market-overview", async (_req, res) => {\n  if (marketCache && Date.now() - marketCache.ts < MARKET_CACHE_TTL) return res.json(marketCache.data);\n'
new = 'app.get("/api/market-overview", async (req, res) => {\n  const nocache = req.query.nocache === "1";\n  if (!nocache && marketCache && Date.now() - marketCache.ts < MARKET_CACHE_TTL) {\n    return res.json(marketCache.data);\n  }\n'
content = content.replace(old, new, 1)
# Also add updatedAt to payload
content = content.replace(
  'marketCache = { data: payload, ts: Date.now() };\n    res.json(payload);',
  'payload.updatedAt = new Date().toISOString();\n    marketCache = { data: payload, ts: Date.now() };\n    res.json(payload);',
  1
)
open('server.ts','w',encoding='utf-8').write(content)
print('done')
