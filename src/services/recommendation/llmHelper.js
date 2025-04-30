// src/services/recommendation/llmHelper.js
import { generateAiResponse } from '../llmClient.js'; // Adjusted path

/**
 * Internal helper to handle LLM interaction and response parsing.
 * @param {string} prompt - The prompt to send to the LLM.
 * @param {string} username - The username for logging purposes.
 * @param {string} type - The type of recommendation for logging (e.g., 'general', 'price-based').
 * @returns {Promise<Array<object>>} - A promise that resolves to the parsed JSON array from the LLM.
 * @throws {Error} - Throws an error if the LLM call or JSON parsing fails.
 */
export const generateRecommendationsCore = async (prompt, username, type = 'unknown') => {
  // --- LLM Interaction ---
  let rawResponse;
  try {
    console.log(`[recommendationService:llmHelper:${type}] Sending prompt to LLM for user ${username}...`);
    rawResponse = await generateAiResponse(prompt);
    console.log(`[recommendationService:llmHelper:${type}] Received raw response from LLM for user ${username}.`);
    // console.log("Raw LLM Response:", rawResponse); // Optional: Log raw response for debugging
  } catch (error) {
    console.error(`[recommendationService:llmHelper:${type}] Error generating AI response for ${username}:`, error);
    throw new Error(`Failed to get recommendations from AI for user ${username} (type: ${type}).`);
  }

  // --- Response Parsing & Formatting ---
  let parsedRecommendations;
  try {
    // Clean the response: remove potential markdown fences and trim whitespace
    const cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedRecommendations = JSON.parse(cleanedResponse);
    console.log(`[recommendationService:llmHelper:${type}] Successfully parsed LLM response for ${username}.`);

    if (!Array.isArray(parsedRecommendations)) {
        throw new Error("LLM response is not a JSON array.");
    }
    return parsedRecommendations; // Return the parsed array on success

  } catch (error) {
    console.error(`[recommendationService:llmHelper:${type}] Error parsing LLM response for ${username}:`, error);
    console.error(`[recommendationService:llmHelper:${type}] Raw response was: ${rawResponse}`);
    throw new Error(`Failed to parse recommendations from AI response for user ${username} (type: ${type}).`);
  }
};