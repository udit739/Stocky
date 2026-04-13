import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function test() {
  const sym = "RELIANCE.BO";
  try {
    const result = await yahooFinance.chart(sym, { range: "5d", interval: "5m", includePrePost: true }, { validateResult: false });
    console.log(`Success ${sym}:`, result?.quotes?.length);
  } catch (e: any) {
    console.error(`Error ${sym}:`, e.message);
  }

  const sym2 = "RELIANCE.NS";
  try {
    const result2 = await yahooFinance.chart(sym2, { range: "5d", interval: "5m", includePrePost: true }, { validateResult: false });
    console.log(`Success ${sym2}:`, result2?.quotes?.length);
  } catch (e: any) {
    console.error(`Error ${sym2}:`, e.message);
  }
}

test();
