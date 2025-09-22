import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

/*
Multi-AI Service Manager - Combining the power of all AI platforms
Routes tasks to the optimal AI platform for maximum performance:
- OpenAI: GPT-5 for general chat and embeddings
- xAI Grok: Complex reasoning and analysis 
- Google Gemini: Fast document processing and multimodal tasks
*/

// Initialize AI clients
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR
});

const grok = new OpenAI({ 
  baseURL: "https://api.x.ai/v1", 
  apiKey: process.env.XAI_API_KEY || ""
});

const gemini = new GoogleGenAI({ 
  apiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || ""
});

export interface AIResponse {
  content: string;
  model: string;
  platform: 'openai' | 'xai' | 'gemini';
  confidence?: number;
}

export interface AIAnalysis {
  summary: string;
  topics: string[];
  keyPoints: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  complexity?: 'low' | 'medium' | 'high';
}

export class MultiAIService {
  
  // Generate embeddings using OpenAI (best for semantic search)
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY_ENV_VAR) {
        console.warn("OpenAI API key not available, using fallback embedding");
        return this.generateFallbackEmbedding(text);
      }

      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.substring(0, 8000), // Limit text length
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating OpenAI embeddings:", error);
      return this.generateFallbackEmbedding(text);
    }
  }

  // Smart AI routing for chat responses
  async generateChatResponse(
    query: string, 
    context?: string, 
    complexity: 'simple' | 'complex' | 'factual' = 'simple'
  ): Promise<AIResponse> {
    
    // Route based on query complexity and type
    if (complexity === 'complex' || query.includes('analyze') || query.includes('explain')) {
      return this.useGrokForComplexReasoning(query, context);
    } else if (complexity === 'factual' || query.includes('what is') || query.includes('who is')) {
      return this.useGeminiForFastResponse(query, context);
    } else {
      return this.useOpenAIForGeneral(query, context);
    }
  }

  // Multi-platform document analysis for maximum insights
  async analyzeDocument(text: string, filename: string): Promise<AIAnalysis> {
    const promises = [
      this.analyzeWithGemini(text, filename),
      this.analyzeWithGrok(text, filename),
      this.analyzeWithOpenAI(text, filename)
    ];

    try {
      // Get analysis from all platforms and combine results
      const results = await Promise.allSettled(promises);
      const validResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<AIAnalysis>).value);

      if (validResults.length === 0) {
        return this.getFallbackAnalysis(filename);
      }

      // Combine insights from all platforms for super-powered analysis
      return this.combineAnalysisResults(validResults);
    } catch (error) {
      console.error("Error in multi-platform analysis:", error);
      return this.getFallbackAnalysis(filename);
    }
  }

  // OpenAI for general chat and reasoning
  private async useOpenAIForGeneral(query: string, context?: string): Promise<AIResponse> {
    try {
      if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY_ENV_VAR) {
        throw new Error("OpenAI API key not available");
      }

      const prompt = context ? 
        `Context: ${context}\n\nQuestion: ${query}\n\nPlease answer based on the context provided.` : 
        query;

      const completion = await openai.chat.completions.create({
        model: "gpt-5", // Latest GPT-5 model
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant that provides accurate and detailed responses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_completion_tokens: 1000,
      });

      return {
        content: completion.choices[0].message.content || "No response generated",
        model: "gpt-5",
        platform: 'openai',
        confidence: 0.9
      };
    } catch (error) {
      console.error("OpenAI error:", error);
      throw error;
    }
  }

  // xAI Grok for complex reasoning and analysis
  private async useGrokForComplexReasoning(query: string, context?: string): Promise<AIResponse> {
    try {
      if (!process.env.XAI_API_KEY) {
        throw new Error("xAI API key not available");
      }

      const prompt = context ? 
        `Context: ${context}\n\nComplex Query: ${query}\n\nProvide detailed analysis and reasoning.` : 
        query;

      const completion = await grok.chat.completions.create({
        model: "grok-2-1212",
        messages: [
          {
            role: "system",
            content: "You are Grok, an AI assistant that excels at complex reasoning, analysis, and providing detailed explanations with logical thinking."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1500,
      });

      return {
        content: completion.choices[0].message.content || "No response generated",
        model: "grok-2-1212",
        platform: 'xai',
        confidence: 0.95
      };
    } catch (error) {
      console.error("Grok error:", error);
      throw error;
    }
  }

  // Google Gemini for fast document processing
  private async useGeminiForFastResponse(query: string, context?: string): Promise<AIResponse> {
    try {
      if (!process.env.GOOGLE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API key not available");
      }

      const prompt = context ? 
        `Context: ${context}\n\nQuestion: ${query}\n\nProvide a fast, accurate response.` : 
        query;

      const response = await gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return {
        content: response.text || "No response generated",
        model: "gemini-2.5-flash",
        platform: 'gemini',
        confidence: 0.85
      };
    } catch (error) {
      console.error("Gemini error:", error);
      throw error;
    }
  }

  // Combine analysis results from multiple AI platforms
  private combineAnalysisResults(results: AIAnalysis[]): AIAnalysis {
    const combinedTopics = new Set<string>();
    const combinedKeyPoints = new Set<string>();
    const summaries: string[] = [];

    results.forEach(result => {
      result.topics.forEach(topic => combinedTopics.add(topic));
      result.keyPoints.forEach(point => combinedKeyPoints.add(point));
      summaries.push(result.summary);
    });

    // Use the longest, most detailed summary
    const bestSummary = summaries.reduce((best, current) => 
      current.length > best.length ? current : best, "");

    return {
      summary: bestSummary || "Document analysis completed",
      topics: Array.from(combinedTopics).slice(0, 10), // Top 10 topics
      keyPoints: Array.from(combinedKeyPoints).slice(0, 8), // Top 8 key points
      complexity: results.length > 1 ? 'high' : 'medium'
    };
  }

  // Individual platform analysis methods
  private async analyzeWithGemini(text: string, filename: string): Promise<AIAnalysis> {
    const prompt = `Analyze this document and extract key insights in JSON format:
{
  "summary": "brief summary",
  "topics": ["topic1", "topic2"],
  "keyPoints": ["point1", "point2"]
}

Document: ${filename}
Content: ${text.substring(0, 4000)}`;

    const response = await gemini.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
    });

    try {
      const result = JSON.parse(response.text || "{}");
      return {
        summary: result.summary || "Gemini analysis completed",
        topics: result.topics || [],
        keyPoints: result.keyPoints || []
      };
    } catch {
      return { summary: "Gemini analysis completed", topics: [], keyPoints: [] };
    }
  }

  private async analyzeWithGrok(text: string, filename: string): Promise<AIAnalysis> {
    const completion = await grok.chat.completions.create({
      model: "grok-2-1212",
      messages: [{
        role: "user",
        content: `Analyze this document with advanced reasoning. Provide JSON response:
{
  "summary": "detailed summary",
  "topics": ["topic1", "topic2"],
  "keyPoints": ["point1", "point2"]
}

Document: ${filename}
Content: ${text.substring(0, 4000)}`
      }],
      response_format: { type: "json_object" },
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        summary: result.summary || "Grok analysis completed",
        topics: result.topics || [],
        keyPoints: result.keyPoints || []
      };
    } catch {
      return { summary: "Grok analysis completed", topics: [], keyPoints: [] };
    }
  }

  private async analyzeWithOpenAI(text: string, filename: string): Promise<AIAnalysis> {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{
        role: "user",
        content: `Analyze this document and provide structured insights in JSON:
{
  "summary": "comprehensive summary",
  "topics": ["topic1", "topic2"],
  "keyPoints": ["point1", "point2"]
}

Document: ${filename}
Content: ${text.substring(0, 4000)}`
      }],
      response_format: { type: "json_object" },
    });

    try {
      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        summary: result.summary || "OpenAI analysis completed",
        topics: result.topics || [],
        keyPoints: result.keyPoints || []
      };
    } catch {
      return { summary: "OpenAI analysis completed", topics: [], keyPoints: [] };
    }
  }

  // Fallback methods when APIs are unavailable
  private generateFallbackEmbedding(text: string): number[] {
    // Simple hash-based embedding for demo
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    return new Array(1536).fill(0).map((_, i) => {
      return Math.sin(hash * (i + 1) * 0.001) * 0.5;
    });
  }

  private getFallbackAnalysis(filename: string): AIAnalysis {
    return {
      summary: `Document ${filename} has been processed for analysis.`,
      topics: ["document", "content", "analysis"],
      keyPoints: ["Document uploaded successfully", "Ready for processing", "Available for search"],
    };
  }

  // Check which AI platforms are available
  async checkAvailablePlatforms(): Promise<{
    openai: boolean;
    xai: boolean;
    gemini: boolean;
  }> {
    return {
      openai: !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR),
      xai: !!process.env.XAI_API_KEY,
      gemini: !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY)
    };
  }
}

export const multiAIService = new MultiAIService();