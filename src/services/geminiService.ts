import { GoogleGenAI, Type } from "@google/genai";
import { STANDARD_INGREDIENTS } from "../constants";

export interface ExtractedIngredient {
  name: string;
  amount: number;
  unit: string;
  mappedId?: string;
}

export interface ExtractedRecipe {
  title: string;
  baseIngredientId?: string;
  ingredients: ExtractedIngredient[];
  instructions: string[];
  technique: string;
  garnish: string;
  difficulty: string;
  flavorProfile: string[];
  history: string;
}

export async function parseRecipe(input: string): Promise<ExtractedRecipe> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const prompt = `
    Extract a cocktail recipe from the following input:
    ---
    ${input}
    ---
    1. Extract the cocktail recipe based on the input above.
    2. Extract or infer the flavor profile (array of short keywords).
    3. Extract or infer the history/story of the cocktail (a short paragraph).
    4. If the content is NOT about a cocktail recipe, you MUST NOT hallucinate. Instead, set the title to "ERROR: No Cocktail Recipe Found" and leave the ingredients list empty.

    Map ingredients to the following standard list if they match:
    ${STANDARD_INGREDIENTS.map(i => `${i.name} (ID: ${i.id})`).join(', ')}

    Return a JSON object following the schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", 
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          baseIngredientId: { type: Type.STRING, description: "ID from the provided standard list for the main spirit" },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          technique: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          garnish: { type: Type.STRING },
          flavorProfile: { type: Type.ARRAY, items: { type: Type.STRING } },
          history: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mappedId: { type: Type.STRING, description: "Use 'others' if not in standard list" },
                name: { type: Type.STRING, description: "Original ingredient name" },
                amount: { type: Type.NUMBER },
                unit: { type: Type.STRING }
              },
              required: ["name", "amount", "unit"]
            }
          }
        },
        required: ["title", "ingredients", "instructions", "technique", "difficulty", "flavorProfile", "history"]
      }
    }
  });

  const extracted = JSON.parse(response.text || "{}");
  return extracted as ExtractedRecipe;
}
