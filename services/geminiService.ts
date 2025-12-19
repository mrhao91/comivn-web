import { GoogleGenAI } from "@google/genai";

// AI Summarization feature has been re-enabled using Google Gemini API.
export const summarizeComic = async (title: string, description: string): Promise<string> => {
  // FIX: Re-implementing AI summarization with Gemini API as per guidelines.
  // The function now generates a summary based on the title and existing description.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = description && description.trim().length > 10 
    ? `Tóm tắt mô tả cho truyện tranh có tên "${title}" một cách ngắn gọn và hấp dẫn bằng tiếng Việt. Mô tả hiện tại là: "${description}"`
    : `Viết một mô tả ngắn gọn và hấp dẫn bằng tiếng Việt cho truyện tranh có tên "${title}".`;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    
    const summary = response.text;
    if (summary && summary.trim().length > 0) {
        return summary.trim();
    }
    // Fallback to original description if AI fails to generate a valid summary
    return description;
  } catch(e) {
    console.error("Error summarizing comic with Gemini:", e);
    // Fallback to original description on error
    return description;
  }
};
