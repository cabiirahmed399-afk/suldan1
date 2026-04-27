import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateBriefSuggestions(idea: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an AI Design Consultant. The user has a rough design idea: "${idea}". 
      Provide 4-5 bulleted suggestions to help them refine their brief. 
      Focus on questions about: Target audience, specific mood/vibe, color palette preferences, and intended usage. 
      Keep the response structured as a simple HTML-friendly list with short, punchy items.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error getting suggestions.";
  }
}

export async function generateDesignDescription(idea: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are an AI Design Assistant. The user has a design idea: "${idea}". 
      Help them expand this into a detailed creative brief for a designer. 
      Keep it professional, concise (under 100 words), and focus on style, mood, and core elements.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating description. Please try again.";
  }
}
