import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function test() {
  const sym = "AAPL";
  try {
    const res: any = await yahooFinance.quoteSummary(sym, {
      modules: ['earnings', 'earningsTrend', 'financialData', 'defaultKeyStatistics']
    });
    console.log("Earnings object:", JSON.stringify(res.earnings, null, 2));
    console.log("EarningsTrend array:", JSON.stringify(res.earningsTrend, null, 2));
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
