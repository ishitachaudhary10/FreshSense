import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI;

export const initializeGemini = (apiKey: string) => {
  genAI = new GoogleGenerativeAI(apiKey);
};

export interface FoodAnalysisResult {
  status: 'fresh' | 'spoiled' | 'uncertain';
  confidence: number;
  foodType: string;
}

export interface MedicineRecommendation {
  severity: string;
  symptoms: string[];
  medicines: {
    name: string;
    usage: string;
    note: string;
  }[];
}


export const getMedicineRecommendations = async (foodType: string, status: string): Promise<MedicineRecommendation[]> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    const prompt = `You are a medical expert. Provide treatment recommendations for food poisoning in JSON format. The recommendations should be organized by severity levels and include appropriate medicines and treatments. Format your response exactly as shown below:

[
  {
    "severity": "Mild",
    "symptoms": ["list", "of", "symptoms"],
    "medicines": [
      {
        "name": "medicine name",
        "usage": "clear usage instructions",
        "note": "important note about the medicine"
      }
    ]
  }
]

Include 2-3 severity levels (Mild, Moderate, Severe) with relevant symptoms and medicine recommendations for ${foodType} that is ${status}. Focus on common, over-the-counter medicines and general treatment guidelines. Ensure all recommendations are medically accurate and conservative.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const parsedData = JSON.parse(text);
      if (!Array.isArray(parsedData)) {
        throw new Error('Response is not an array');
      }
      return parsedData;
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      // Try to extract JSON from the text if it's wrapped in other content
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Invalid response format from AI');
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw new Error('Failed to get medicine recommendations: ' + error.message);
  }
}; 