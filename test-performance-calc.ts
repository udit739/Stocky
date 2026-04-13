import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function getTrailingReturns(symbol: string) {
  try {
    const period1 = new Date();
    period1.setFullYear(period1.getFullYear() - 5);
    period1.setDate(period1.getDate() - 7); // pad

    const res = await yahooFinance.chart(symbol, {
      period1,
      interval: '1mo'
    });

    const quotes = res.quotes || [];
    if (quotes.length === 0) return null;

    const currentPrice = quotes[quotes.length - 1].close;
    
    // YTD: last available quote of previous year
    const currentYear = new Date().getFullYear();
    const lastYearQuotes = quotes.filter(q => q.date.getFullYear() < currentYear);
    const ytdStartPrice = lastYearQuotes.length > 0 ? lastYearQuotes[lastYearQuotes.length - 1].close : null;

    // 1-Year: roughly 12 months ago
    const oneYearAgoDate = new Date();
    oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
    const quote1y = quotes.find(q => q.date >= oneYearAgoDate) || quotes[quotes.length - 12];
    const price1y = quote1y ? quote1y.close : null;

    // 3-Year: roughly 36 months ago
    const threeYearAgoDate = new Date();
    threeYearAgoDate.setFullYear(threeYearAgoDate.getFullYear() - 3);
    const quote3y = quotes.find(q => q.date >= threeYearAgoDate) || quotes[quotes.length - 36];
    const price3y = quote3y ? quote3y.close : null;

    // 5-Year: first quote
    const price5y = quotes[0].close;

    const calcReturn = (past: number | null) => past ? ((currentPrice - past) / past) * 100 : null;

    return {
      ytd: calcReturn(ytdStartPrice),
      oneYear: calcReturn(price1y),
      threeYear: calcReturn(price3y),
      fiveYear: calcReturn(price5y),
    };
  } catch (e: any) {
    console.error(e.message);
    return null;
  }
}

async function test() {
  const tsla = await getTrailingReturns("TSLA");
  const sp500 = await getTrailingReturns("^GSPC");
  console.log("TSLA", tsla);
  console.log("S&P 500", sp500);
}
test();
