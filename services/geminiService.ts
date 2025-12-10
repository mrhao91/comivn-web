import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client safely
// NOTE: In a real app, never expose API keys on the client side without restrictions.
const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const summarizeComic = async (title: string, description: string): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "Vui lòng cấu hình API Key để sử dụng tính năng AI.";
  }

  try {
    const model = "gemini-2.5-flash";
    const prompt = `Bạn là một biên tập viên truyện tranh chuyên nghiệp. Hãy viết một đoạn tóm tắt ngắn gọn, hấp dẫn (khoảng 3 câu) bằng tiếng Việt cho bộ truyện "${title}" dựa trên mô tả sau: "${description}". Hãy thêm một chút đánh giá về lý do tại sao nên đọc nó.`;

    const response = await client.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "Không thể tạo tóm tắt.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Đã xảy ra lỗi khi kết nối với AI.";
  }
};
