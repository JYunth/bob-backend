// src/services/recommendation/complementaryService.js
import { getUserBar } from '../baxusClient.js'; // Adjusted path
import { bottlesMap } from '../../utils/dataLoader.js'; // Adjusted path
import { generateRecommendationsCore } from './llmHelper.js';
import { getOwnedBottleIds, filterCandidates, filterHallucinations, mapRecommendationsToDetails } from './candidateUtils.js';
import { NUM_RECOMMENDATIONS } from './constants.js';

/**
 * Generates complementary whisky recommendations (e.g., different styles).
 * @param {string} username - The Baxus username.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of recommendation objects.
 * @throws {Error} - Throws an error if fetching data fails or logic encounters issues.
 */
export const getComplementaryRecommendations = async (username) => {
  const recommendationType = 'complementary';
  console.log(`[recommendationService:${recommendationType}] Starting recommendations for user: ${username}`);

  let baxusData;
  try {
    baxusData = await getUserBar(username);
    console.log(`[recommendationService:${recommendationType}] Fetched bar data. Items: ${baxusData?.length || 0}`);
    if (!baxusData) {
      console.warn(`[recommendationService:${recommendationType}] User ${username} has missing bar data.`);
      baxusData = []; // Treat missing data as an empty bar
    }
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error fetching user bar data for ${username}:`, error);
    throw new Error(`Failed to fetch bar data for complementary recommendations for user ${username}.`);
  }

  // --- Data Filtering ---
  const ownedBottleIds = getOwnedBottleIds(baxusData);
  console.log(`[recommendationService:${recommendationType}] User owns ${ownedBottleIds.size} unique product IDs.`);

  // Extract fields needed for the prompt (name, spirit, proof)
  const fieldsExtractor = (id, bottle) => ({
    id: id,
    name: bottle.name,
    spirit: bottle.spirit,
    proof: bottle.proof,
  });
  const recommendationCandidates = filterCandidates(ownedBottleIds, bottlesMap, undefined, fieldsExtractor); // Use default MAX_CANDIDATES
  console.log(`[recommendationService:${recommendationType}] Filtered down to ${recommendationCandidates.length} recommendation candidates.`);

  if (recommendationCandidates.length === 0) {
      console.warn(`[recommendationService:${recommendationType}] No recommendation candidates found after filtering for user ${username}.`);
      return [];
  }

  // --- Prompt Construction ---
  const ownedBottleSummary = baxusData.length > 0
      ? baxusData
          .slice(0, 20) // Limit summary size
          .map(item => {
              const product = item.product;
              if (!product || !product.id) return null;
              const details = bottlesMap.get(product.id);
              // Simple summary: Name (ID, Spirit)
              return `${product.name || 'Unknown Bottle'} (ID: ${product.id}${details ? `, Spirit: ${details.spirit}` : ''})`;
          })
          .filter(item => item !== null)
          .join('; ')
      : 'User bar is empty or data unavailable.';

  const candidateSummary = recommendationCandidates
      .map(b => `${b.name} (ID: ${b.id}, Spirit: ${b.spirit}, Proof: ${b.proof})`) // Include relevant details
      .join('; ');

  const prompt = `
System: You are an expert whisky recommender AI specializing in diversifying a user's collection. Your goal is to suggest whiskies that offer different styles, regions, or profiles compared to what the user already owns.

User's Current Whisky Collection Summary (Owned Bottles - Name, ID, Spirit):
${ownedBottleSummary}
(Note: This might be a partial list if the user owns many bottles, or empty if none are owned)

Potential Recommendation Candidates (Bottles the user does NOT own - Name, ID, Spirit, Proof):
${candidateSummary}

Task:
Analyze the user's collection profile. From the 'Potential Recommendation Candidates' list, recommend ${NUM_RECOMMENDATIONS} whiskies that would best *diversify* the user's collection. Focus on suggesting bottles with different spirits, styles (e.g., peated vs unpeated, sherry vs bourbon cask), regions, or proof points compared to the bulk of their current collection. For each recommendation, provide its ID and a brief reasoning (1-2 sentences) explaining *how* it adds diversity to the user's existing collection based on the provided summaries.

Output Format:
Return ONLY a valid JSON array containing ${NUM_RECOMMENDATIONS} objects, where each object has the following structure: {"id": <bottle_id>, "reasoning": "..."}. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\` outside the JSON array itself.

Example Output:
[{"id": 333, "reasoning": "Adds diversity by introducing a heavily peated Islay malt, contrasting with your mainly Speyside collection."}, {"id": 777, "reasoning": "Diversifies your collection with a Japanese whisky, offering a different regional profile."}]
`;

  // --- Generate Recommendations using Helper ---
  // Note: The original code had duplicated LLM call/parsing logic here.
  // We now use the llmHelper and candidateUtils for consistency.
  let parsedRecommendations;
  try {
    console.log(`[recommendationService:${recommendationType}] Calling helper for user ${username}...`);
    parsedRecommendations = await generateRecommendationsCore(prompt, username, recommendationType);
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error getting recommendations for ${username}:`, error);
    throw new Error(`Failed to get complementary recommendations for user ${username}. Details: ${error.message}`);
  }

  // --- LLM Hallucination Check ---
  // Note: Original code had hallucination check *after* mapping. Moved it before mapping for correctness.
  const validParsedRecommendations = filterHallucinations(parsedRecommendations, recommendationCandidates, username, recommendationType);

  // --- Format Final Response ---
  // Include 'average_msrp' in the final output for complementary recommendations
  const detailedRecommendations = mapRecommendationsToDetails(validParsedRecommendations, bottlesMap, username, recommendationType, ['avg_msrp']);

  console.log(`[recommendationService:${recommendationType}] Formatted ${detailedRecommendations.length} final recommendations for user ${username}.`);
  return detailedRecommendations;
};