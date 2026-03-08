import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-1.5-flash",
            contents: "Are you working?",
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        answer: { type: Type.STRING }
                    }
                }
            }
        });
        fs.writeFileSync('result.json', JSON.stringify({ success: true, text: response.text }, null, 2));
    } catch (error) {
        fs.writeFileSync('error.json', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
}
run();
