import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function run() {
    try {
        const modelsResponse = await ai.models.list();
        // In some SDK versions it returns an array directly, in some it's page based, 
        // we'll just try to dump whatever we get
        let names = [];
        if (Array.isArray(modelsResponse)) {
            names = modelsResponse.map(m => m.name);
        } else if (modelsResponse.models) {
            names = modelsResponse.models.map(m => m.name);
        } else {
            names = modelsResponse;
        }
        fs.writeFileSync('models.json', JSON.stringify({ success: true, names }, null, 2));
    } catch (error) {
        fs.writeFileSync('error_models.json', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }
}
run();
