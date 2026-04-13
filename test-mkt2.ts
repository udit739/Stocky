import YahooFinance from "yahoo-finance2";
const yf = new YahooFinance();

async function test() {
  const symbols = ['^GSPC', '^IXIC', '^DJI', 'GC=F', 'EURUSD=X', '^TNX'];
  const raw: any = await yf.quote(symbols as any);
  const arr = Array.isArray(raw) ? raw : [raw];
  for (const q of arr) {
    console.log(`${q.symbol}: price=${q.regularMarketPrice}, change=${q.regularMarketChange}, changePct=${q.regularMarketChangePercent}`);
  }
}
test();
