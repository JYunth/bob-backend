// src/services/recommendationService.js
import { getUserBar } from './baxusClient.js';
import { generateAiResponse } from './llmClient.js';
import { bottlesMap } from '../utils/dataLoader.js';
import config from '../../config/index.js';

const MAX_CANDIDATES = 100; // Limit the number of candidates sent to the LLM
const NUM_RECOMMENDATIONS = 5; // Desired number of recommendations

/**
 * Generates whisky recommendations for a user based on their current bar.
 * @param {string} username - The Baxus username.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of recommendation objects.
 * @throws {Error} - Throws an error if fetching data, generating AI response, or parsing fails.
 */
export const getRecommendations = async (username) => {
  console.log(`[recommendationService] Starting recommendations for user: ${username}`);

  let baxusData;
  try {
    baxusData = await getUserBar(username);
    // Assuming baxusData is the array directly
    console.log(`[recommendationService] Fetched bar data for ${username}. Items: ${baxusData?.length || 0}`);
    if (!baxusData || baxusData.length === 0) {
      console.warn(`[recommendationService] User ${username} has an empty bar or data is missing/empty.`);
      // Decide how to handle empty bar: throw error, return empty array, or suggest popular bottles?
      // For now, let's return an empty array.
      return [];
    }
  } catch (error) {
    console.error(`[recommendationService] Error fetching user bar data for ${username}:`, error);
    throw new Error(`Failed to fetch bar data for user ${username}.`);
  }

  // --- Data Filtering ---
  // Extract owned bottle IDs assuming baxusData is an array of items with a product property
  const ownedBottleIds = new Set(baxusData.map(item => item.product?.id).filter(id => id != null));
  console.log(`[recommendationService] User owns ${ownedBottleIds.size} unique product IDs.`);

  const recommendationCandidates = [];
  for (const [id, bottle] of bottlesMap.entries()) {
    if (!ownedBottleIds.has(id)) {
      recommendationCandidates.push({ id: id, name: bottle.name }); // Include name for better LLM context
    }
    if (recommendationCandidates.length >= MAX_CANDIDATES) {
      break;
    }
  }
  console.log(`[recommendationService] Filtered down to ${recommendationCandidates.length} recommendation candidates.`);

  if (recommendationCandidates.length === 0) {
      console.warn(`[recommendationService] No recommendation candidates found after filtering for user ${username}.`);
      return []; // No candidates to recommend from
  }

  // --- Prompt Construction ---
  // Create summary from the direct array structure
  const ownedBottleSummary = baxusData
      .slice(0, 20) // Limit summary size
      .map(item => `${item.product?.name || 'Unknown Bottle'} (ID: ${item.product?.id})`)
      .filter(item => item.includes('ID: ') && !item.includes('ID: null')) // Ensure ID exists for summary
      .join(', ');
  const candidateSummary = recommendationCandidates.map(b => `${b.name} (ID: ${b.id})`).join(', ');

  const prompt = `
System: You are an expert whisky recommender AI. Your goal is to suggest new whiskies to a user based on their existing collection and a list of potential candidates.

User's Current Whisky Collection Summary (Owned Bottle IDs and Names):
${ownedBottleSummary}
(Note: This might be a partial list if the user owns many bottles)

Potential Recommendation Candidates (Bottles the user does NOT own):
${candidateSummary}

Task:
Based on the user's collection and the provided candidates, recommend ${NUM_RECOMMENDATIONS} whiskies from the 'Potential Recommendation Candidates' list that you think the user would enjoy. For each recommendation, provide a brief reasoning (1-2 sentences).

Output Format:
Return ONLY a valid JSON array containing ${NUM_RECOMMENDATIONS} objects, where each object has the following structure: {"id": <bottle_id>, "reasoning": "..."}. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\` outside the JSON array itself.

Example Output:
[{"id": 123, "reasoning": "Based on your love for peated Islay malts, this offers a similar smoky profile."}, {"id": 456, "reasoning": "Since you enjoy smooth Speyside whiskies, this sherry-finished expression might be a good fit."}]
`;

  // --- LLM Interaction ---
  let rawResponse;
  try {
    console.log(`[recommendationService] Sending prompt to LLM for user ${username}...`);
    rawResponse = await generateAiResponse(prompt);
    console.log(`[recommendationService] Received raw response from LLM for user ${username}.`);
    // console.log("Raw LLM Response:", rawResponse); // Optional: Log raw response for debugging
  } catch (error) {
    console.error(`[recommendationService] Error generating AI response for ${username}:`, error);
    throw new Error(`Failed to get recommendations from AI for user ${username}.`);
  }

  // --- Response Parsing & Formatting ---
  let parsedRecommendations;
  try {
    // Clean the response: remove potential markdown fences and trim whitespace
    const cleanedResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    parsedRecommendations = JSON.parse(cleanedResponse);
    console.log(`[recommendationService] Successfully parsed LLM response for ${username}.`);

    if (!Array.isArray(parsedRecommendations)) {
        throw new Error("LLM response is not a JSON array.");
    }

  } catch (error) {
    console.error(`[recommendationService] Error parsing LLM response for ${username}:`, error);
    console.error(`[recommendationService] Raw response was: ${rawResponse}`);
    throw new Error(`Failed to parse recommendations from AI response for user ${username}.`);
  }

  // Map parsed IDs to full bottle details and format
  const detailedRecommendations = parsedRecommendations
    .map(rec => {
      if (!rec.id || typeof rec.reasoning !== 'string') {
        console.warn(`[recommendationService] Skipping invalid recommendation format from LLM:`, rec);
        return null; // Skip invalid entries
      }
      const bottleDetails = bottlesMap.get(rec.id);
      if (bottleDetails) {
        return {
          id: rec.id,
          name: bottleDetails.name,
          image_url: bottleDetails.image_url,
          spirit: bottleDetails.spirit, // Assuming 'spirit' field exists
          proof: bottleDetails.proof,
          average_msrp: bottleDetails.average_msrp,
          rationale: rec.reasoning // Use 'rationale' for consistency
        };
      } else {
        console.warn(`[recommendationService] Recommended bottle ID ${rec.id} not found in bottlesMap.`);
        return null; // Skip if bottle details not found
      }
    })
    .filter(rec => rec !== null); // Filter out null entries

  console.log(`[recommendationService] Formatted ${detailedRecommendations.length} recommendations for user ${username}.`);
  return detailedRecommendations;
};