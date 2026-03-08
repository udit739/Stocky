import dotenv from "dotenv";
import { getStockPrediction } from "./src/services/geminiService";

dotenv.config();

// Dummy data
const data = [
    { date: "2024-01-01", close: 150, volume: 1000000, rsi: 50 },
    { date: "2024-01-02", close: 155, volume: 1200000, rsi: 60 }
];

async function run() {
    try {
        const res = await getStockPrediction("AAPL", data);
        console.log(res);
    } catch (error) {
        console.error("Test Error:", error);
    }
}

run();
