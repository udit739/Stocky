import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function test() {
  const sym = "TSLA";
  try {
    const res: any = await yahooFinance.quoteSummary(sym, {
      modules: [
        'defaultKeyStatistics', 
        'financialData', 
        'fundPerformance', 
        'price',
        'summaryDetail',
        'institutionOwnership',
        'majorDirectHolders',
        'majorHoldersBreakdown'
      ]
    });
    console.log("defaultKeyStatistics:", res.defaultKeyStatistics?.['52WeekChange'], res.defaultKeyStatistics?.['SandP52WeekChange']);
    console.log("ytdReturn:", res.defaultKeyStatistics?.ytdReturn);
    console.log("fundPerformance:", res.fundPerformance);
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
