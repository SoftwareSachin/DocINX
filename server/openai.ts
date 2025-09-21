import { GoogleGenAI } from "@google/genai";

/*
Follow these instructions when using this blueprint:
- Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"
- do not change this unless explicitly requested by the user
*/

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ""
});

// Note: Gemini doesn't provide embedding models, using text-embedding-3-small would require OpenAI
// For now, we'll create a simple hash-based embedding for demo purposes
export async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    // Simple hash-based embedding for demo - in production you'd use a proper embedding service
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    // Create a 1536-dimensional vector (matching OpenAI's embedding size)
    const embedding = new Array(1536).fill(0).map((_, i) => {
      return Math.sin(hash * (i + 1) * 0.001) * 0.5;
    });
    
    return embedding;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error("Failed to generate embeddings");
  }
}

// Generate chat completion with RAG context
export async function generateChatCompletion(
  query: string,
  context: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  try {
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      {
        role: "system",
        content: "You are a helpful AI assistant that answers questions based on provided document context. Use only the information from the context to answer questions. If the context doesn't contain enough information, clearly state that. Always be concise and accurate, and cite your sources when possible."
      }
    ];

    // Add conversation history if provided
    if (conversationHistory) {
      messages.push(...conversationHistory);
    }

    // Add the current query with context
    messages.push({
      role: "user",
      content: `Context from documents:
${context}

Question: ${query}

Instructions:
1. Answer the question based only on the provided context
2. Be concise and accurate
3. If you reference specific information, indicate which source
4. If the context doesn't contain relevant information, clearly state that

Answer:`
    });

    // Build prompt for Gemini
    const fullPrompt = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: fullPrompt,
    });

    return response.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating chat completion:", error);
    throw new Error("Failed to generate response");
  }
}

// Analyze document content and extract metadata
export async function analyzeDocument(text: string, filename: string): Promise<{
  summary: string;
  topics: string[];
  keyPoints: string[];
}> {
  try {
    const prompt = `Analyze the following document content and provide a structured analysis. Return your response in JSON format with the following structure:
{
  "summary": "A brief 2-3 sentence summary of the document",
  "topics": ["topic1", "topic2", "topic3"],
  "keyPoints": ["key point 1", "key point 2", "key point 3"]
}

Document filename: ${filename}
Document content:
${text.substring(0, 4000)}...`;

    const systemPrompt = `You are a document analysis expert. Analyze documents and extract key information in the requested JSON format.\n\n${prompt}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            topics: { type: "array", items: { type: "string" } },
            keyPoints: { type: "array", items: { type: "string" } }
          },
          required: ["summary", "topics", "keyPoints"]
        }
      },
      contents: systemPrompt,
    });

    const result = JSON.parse(response.text || "{}");
    
    return {
      summary: result.summary || "No summary available",
      topics: result.topics || [],
      keyPoints: result.keyPoints || [],
    };
  } catch (error) {
    console.error("Error analyzing document:", error);
    return {
      summary: "Document analysis failed",
      topics: [],
      keyPoints: [],
    };
  }
}

// Generate search queries for semantic search
export async function generateSearchQueries(userQuery: string): Promise<string[]> {
  try {
    const prompt = `Given the user query, generate 3-5 alternative search queries that could help find relevant information. Return the queries as a JSON array of strings.

User query: "${userQuery}"

Generate queries that:
1. Use different wording but same intent
2. Include more specific terms
3. Include broader terms
4. Use synonyms and related concepts

Return format: ["query1", "query2", "query3", "query4", "query5"]`;

    const systemPrompt = `You are a search query expert. Generate alternative search queries to improve information retrieval.\n\n${prompt}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            queries: { type: "array", items: { type: "string" } }
          },
          required: ["queries"]
        }
      },
      contents: systemPrompt,
    });

    const result = JSON.parse(response.text || '{"queries": []}');
    return result.queries || [userQuery];
  } catch (error) {
    console.error("Error generating search queries:", error);
    return [userQuery];
  }
}
