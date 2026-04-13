async function test() {
  const syms = ["RELIANCE.BO", "RELIANCE.NS"];
  for (const sym of syms) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=5m&range=5d`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`${sym} quote len:`, data?.chart?.result?.[0]?.timestamp?.length || 0);
  }
}
test();
