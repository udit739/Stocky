export function calculateRSI(closingPrices: number[], period: number = 14): { rsiData: number[], latestRSI: number | null } {
    if (closingPrices.length < period + 1) {
        return { rsiData: new Array(closingPrices.length).fill(null), latestRSI: null };
    }

    const rsiData: (number | null)[] = new Array(period).fill(null);

    // Calculate initial average gain and loss
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
        const change = closingPrices[i] - closingPrices[i - 1];
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss += Math.abs(change);
        }
    }

    avgGain /= period;
    avgLoss /= period;

    let rs = avgGain / avgLoss;
    let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    rsiData.push(rsi);

    // Calculate smoothed RSI for the rest of the data
    for (let i = period + 1; i < closingPrices.length; i++) {
        const change = closingPrices[i] - closingPrices[i - 1];
        let gain = 0;
        let loss = 0;

        if (change > 0) {
            gain = change;
        } else {
            loss = Math.abs(change);
        }

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        rs = avgGain / avgLoss;
        rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
        rsiData.push(rsi);
    }

    const firstValidRSI = rsiData[period];
    for (let i = 0; i < period; i++) {
        rsiData[i] = firstValidRSI;
    }

    return {
        // Replace nulls with 50 (neutral) or just keep them as null depending on chart library preference
        // Chart.js handles nulls by breaking the line, which is usually correct for the start of an RSI indicator
        rsiData: rsiData as number[],
        latestRSI: rsiData[rsiData.length - 1] as number
    };
}

export function calculateSMA(closingPrices: number[], period: number): (number | null)[] {
    if (closingPrices.length < period) {
        return new Array(closingPrices.length).fill(null);
    }

    const smaData: (number | null)[] = new Array(period - 1).fill(null);

    for (let i = period - 1; i < closingPrices.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += closingPrices[i - j];
        }
        smaData.push(sum / period);
    }

    // Backfill leading nulls with the first valid SMA value
    // so the line renders continuously from the left edge of the chart
    const firstValidSMA = smaData[period - 1];
    for (let i = 0; i < period - 1; i++) {
        smaData[i] = firstValidSMA;
    }

    return smaData;
}

// ──────────────────────────────────────────────
// ARIMA Forecast
// ──────────────────────────────────────────────
// We use the `arima` npm package (already installed).
// It exposes a default‑export class / function depending on version.
// The package is a CJS module so we use a dynamic require() at runtime
// (server‑side only – this file is also bundled for the browser but
//  the browser path never calls computeARIMA).

/**
 * Fit ARIMA(p, d, q) on `prices` and return `steps` future values.
 * @param prices  Array of historical closing prices (chronological order).
 * @param steps   Number of future data points to forecast (default 7).
 * @param p       AR order (default 2)
 * @param d       Differencing order (default 1)
 * @param q       MA order (default 2)
 */
export function computeARIMA(
    prices: number[],
    steps = 7,
    p = 2,
    d = 1,
    q = 2
): number[] {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const ARIMA = (require as any)("arima");
        // The `arima` package exports a constructor as either the module itself or .default
        const ARIMAClass = ARIMA.default ?? ARIMA;
        const model = new ARIMAClass({ p, d, q, verbose: false });
        model.train(prices);
        const [forecast] = model.predict(steps) as [number[], number[]];
        return forecast.map((v: number) => Math.max(0, v));
    } catch (err) {
        console.error("[ARIMA] Forecasting failed:", err);
        // Fallback: repeat last known price
        return Array(steps).fill(prices[prices.length - 1]);
    }
}

// ──────────────────────────────────────────────
// EMA — Exponential Moving Average
// ──────────────────────────────────────────────
export function calculateEMA(prices: number[], period: number): number[] {
    if (prices.length === 0) return [];
    const k = 2 / (period + 1);

    // Seed with SMA of first `period` values
    let seed = 0;
    const start = Math.min(period, prices.length);
    for (let i = 0; i < start; i++) seed += prices[i];
    seed /= start;

    const ema: number[] = new Array(prices.length).fill(0);
    ema[start - 1] = seed;

    for (let i = start; i < prices.length; i++) {
        ema[i] = prices[i] * k + ema[i - 1] * (1 - k);
    }
    // Back-fill leading zeros with the first valid EMA
    for (let i = 0; i < start - 1; i++) {
        ema[i] = ema[start - 1];
    }
    return ema;
}

// ──────────────────────────────────────────────
// MACD — Moving Average Convergence Divergence
// ──────────────────────────────────────────────
export interface MACDResult {
    macd: number[];       // EMA12 - EMA26
    signal: number[];     // EMA9 of MACD
    histogram: number[];  // MACD - Signal
}

export function calculateMACD(prices: number[]): MACDResult {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);

    const macd = prices.map((_, i) => ema12[i] - ema26[i]);
    const signal = calculateEMA(macd, 9);
    const histogram = macd.map((v, i) => v - signal[i]);

    return { macd, signal, histogram };
}
