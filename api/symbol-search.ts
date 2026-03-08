import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { q } = req.query;
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
    }
    if (!apiKey) {
        return res.status(500).json({ error: "ALPHA_VANTAGE_API_KEY is not configured" });
    }

    try {
        const response = await fetch(
            `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`
        );
        const data: any = await response.json();

        if (data["Note"] || data["Information"]) {
            return res.json({ bestMatches: [] });
        }

        const matches = (data["bestMatches"] || []).slice(0, 8).map((m: any) => ({
            symbol: m["1. symbol"],
            name: m["2. name"],
            type: m["3. type"],
            region: m["4. region"],
            currency: m["8. currency"],
        }));

        res.json({ bestMatches: matches });
    } catch (error) {
        console.error("Error searching symbols:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
