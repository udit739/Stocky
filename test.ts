import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

async function run() {
  try {
    const res = await yahooFinance.chart("AAPL", { 
        period1: new Date(Date.now() - 24 * 60 * 60 * 1000 * 4), 
        interval: "5m" 
    });
    
    const quotes = (res.quotes as any[]).filter(q => q.close !== null);
    if (quotes.length === 0) { console.log("No quotes returned"); return; }

    const lastQuote = quotes[quotes.length - 1];
    const lastDayStr = new Date(lastQuote.date).toISOString().split('T')[0];
    const dayQuotes = quotes.filter(q => new Date(q.date).toISOString().startsWith(lastDayStr));

    console.log("Total quotes:", quotes.length);
    console.log("Latest day:", lastDayStr, "->", dayQuotes.length, "bars");
    console.log("First bar:", dayQuotes[0]?.date, "@", dayQuotes[0]?.close);
    console.log("Last bar:", dayQuotes[dayQuotes.length - 1]?.date, "@", dayQuotes[dayQuotes.length - 1]?.close);
  } catch (e: any) {
    console.error("ERROR", e.message);
  }
}

run();
