import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function test() {
  const sym = "TSLA";
  try {
    const res: any = await yahooFinance.quoteSummary(sym, {
      modules: ['financialData', 'defaultKeyStatistics']
    });
    console.log("financialData:", JSON.stringify(res.financialData, null, 2));
    console.log("defaultKeyStatistics:", JSON.stringify(res.defaultKeyStatistics, null, 2));
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
