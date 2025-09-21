import { GoogleGenAI } from "@google/genai";

// DON'T DELETE THIS COMMENT
// Follow these instructions when using this blueprint:
// - Note that the newest Gemini model series is "gemini-2.5-flash" or gemini-2.5-pro"
//   - do not change this unless explicitly requested by the user

// This API key is from Gemini Developer API Key, not vertex AI API Key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateChatResponse(query: string, documentContext?: string): Promise<string> {
    try {
        let prompt = query;
        
        // If we have document context, use it for RAG
        if (documentContext && documentContext.trim()) {
            prompt = `Based on the following document content, please answer the user's question. If the answer cannot be found in the provided content, please say so clearly.

Document Content:
${documentContext}

User Question: ${query}

Please provide a helpful and accurate response based on the document content above.`;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text || "I apologize, but I'm unable to provide a response at the moment. Please try again.";
    } catch (error) {
        console.error('Gemini API error:', error);
        return "I'm experiencing technical difficulties connecting to the AI service. Please try again later.";
    }
}

export async function summarizeDocument(text: string): Promise<string> {
    try {
        const prompt = `Please provide a comprehensive summary of the following document, highlighting the key points, main topics, and important information:\n\n${text}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text || "Unable to generate summary";
    } catch (error) {
        console.error('Document summarization error:', error);
        return "Failed to summarize document";
    }
}