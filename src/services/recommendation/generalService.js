// src/services/recommendation/generalService.js
import { getUserBar } from '../baxusClient.js'; // Adjusted path
import { bottlesMap } from '../../utils/dataLoader.js'; // Adjusted path
import { generateRecommendationsCore } from './llmHelper.js';
import { getOwnedBottleIds, filterCandidates, filterHallucinations, mapRecommendationsToDetails } from './candidateUtils.js';
import { NUM_RECOMMENDATIONS } from './constants.js';

/**
 * Generates general whisky recommendations for a user based on their current bar.
 * @param {string} username - The Baxus username.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of recommendation objects.
 * @throws {Error} - Throws an error if fetching data, generating AI response, or parsing fails.
 */
export const getGeneralRecommendations = async (username) => {
  const recommendationType = 'general';
  console.log(`[recommendationService:${recommendationType}] Starting recommendations for user: ${username}`);

  let baxusData;
  try {
    baxusData = await getUserBar(username);
    console.log(`[recommendationService:${recommendationType}] Fetched bar data for ${username}. Items: ${baxusData?.length || 0}`);
    if (!baxusData || baxusData.length === 0) {
      console.warn(`[recommendationService:${recommendationType}] User ${username} has an empty bar or data is missing/empty. Returning empty array.`);
      return [];
    }
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error fetching user bar data for ${username}:`, error);
    throw new Error(`Failed to fetch bar data for user ${username}.`);
  }

  // --- Data Filtering ---
  const ownedBottleIds = getOwnedBottleIds(baxusData);
  console.log(`[recommendationService:${recommendationType}] User owns ${ownedBottleIds.size} unique product IDs.`);

  // Use default fieldsExtractor: { id, name }
  const recommendationCandidates = filterCandidates(ownedBottleIds, bottlesMap);
  console.log(`[recommendationService:${recommendationType}] Filtered down to ${recommendationCandidates.length} recommendation candidates.`);

  if (recommendationCandidates.length === 0) {
      console.warn(`[recommendationService:${recommendationType}] No recommendation candidates found after filtering for user ${username}.`);
      return []; // No candidates to recommend from
  }

  // --- Prompt Construction ---
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

  // --- Generate Recommendations using Helper ---
  let parsedRecommendations;
  try {
    parsedRecommendations = await generateRecommendationsCore(prompt, username, recommendationType);
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error getting recommendations for ${username}:`, error);
    throw new Error(`Failed to get recommendations for user ${username}. Details: ${error.message}`);
  }

  // --- LLM Hallucination Check ---
  const validParsedRecommendations = filterHallucinations(parsedRecommendations, recommendationCandidates, username, recommendationType);

  // --- Format Final Response ---
  // Include 'average_msrp' in the final output for general recommendations
  const detailedRecommendations = mapRecommendationsToDetails(validParsedRecommendations, bottlesMap, username, recommendationType, ['avg_msrp']);

  console.log(`[recommendationService:${recommendationType}] Formatted ${detailedRecommendations.length} final recommendations for user ${username}.`);
  return detailedRecommendations;
};