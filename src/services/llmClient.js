// 1. Import GoogleGenerativeAI
import { GoogleGenerativeAI } from "@google/generative-ai";

// 2. Import config
import config from "../../config/index.js";

// 3. Initialize GoogleGenerativeAI client
// Ensure the API key is provided in the config
if (!config.googleApiKey) {
  throw new Error("Google API Key is missing in the configuration.");
}
const genAI = new GoogleGenerativeAI(config.googleApiKey);

// 4. Get the generative model instance
// Ensure the model name is provided in the config
if (!config.llmModel) {
  throw new Error("LLM Model name is missing in the configuration.");
}
const model = genAI.getGenerativeModel({ model: config.llmModel });

// 5. Define and export the async function
/**
 * Generates a response from the configured AI model based on the provided prompt.
 * @param {string} prompt - The input prompt for the AI model.
 * @returns {Promise<string>} - A promise that resolves with the generated text content.
 * @throws {Error} - Throws an error if the AI model fails to generate content or if the prompt is invalid.
 */
const generateAiResponse = async (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error("Invalid prompt provided to generateAiResponse.");
  }
  // 6. Use try...catch for error handling
  try {
    // 7. Call generateContent
    const result = await model.generateContent(prompt);
    // 8. Access response
    const response = result.response;
    // 9. Extract text
    const text = response.text();
    // 10. Return text
    return text;
  } catch (error) {
    // 11. Log and throw error
    console.error("Error generating content from AI model:", error);
    throw new Error(`Failed to generate content from AI model: ${error.message}`);
  }
};

export { generateAiResponse };