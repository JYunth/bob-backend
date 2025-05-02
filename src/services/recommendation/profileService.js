// src/services/recommendation/profileService.js
import fetch from 'node-fetch'; // Assuming node-fetch is available or use native fetch if Node version supports it
import { getUserBar } from '../baxusClient.js';
import { bottlesMap } from '../../utils/dataLoader.js'; // Adjusted path
import { generateRecommendationsCore } from './llmHelper.js';
import { getOwnedBottleIds, filterCandidates, filterHallucinations, mapRecommendationsToDetails } from './candidateUtils.js';
import { NUM_RECOMMENDATIONS } from './constants.js';

/**
 * Generates whisky recommendations based on a user profile focus.
 * @param {string} username - The Baxus username.
 * @param {string} profileFocus - The profile focus (e.g., 'peaty', 'sherry', 'beginner').
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of recommendation objects.
 * @throws {Error} - Throws an error if fetching data fails or logic encounters issues.
 */
export const getProfileRecommendations = async (username, profileFocus) => {
  const recommendationType = 'profile';
  console.log(`[recommendationService:${recommendationType}] Getting recommendations for user: ${username}, focus: ${profileFocus || 'general profile'}`);

  let baxusData;
  let wishlistData = []; // Initialize wishlistData
  try {
    baxusData = await getUserBar(username);
    console.log(`[recommendationService:${recommendationType}] Fetched bar data. Count: ${baxusData?.length ?? 0}`);
    if (!baxusData) {
      console.warn(`[recommendationService:${recommendationType}] User ${username} has missing or empty bar data.`);
      baxusData = []; // Ensure baxusData is an array
    }
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error fetching user bar data for ${username}:`, error.message);
    throw new Error(`Failed to fetch bar data for profile-based recommendations for user ${username}.`);
  }

  // Fetch Wishlist Data
  try {
    const wishlistUrl = `http://localhost:3000/api/proxy/wishlist/${username}`; // Adjust URL as needed
    const response = await fetch(wishlistUrl);
    if (response.ok) {
      wishlistData = await response.json();
      console.log(`[recommendationService:${recommendationType}] Fetched wishlist data for ${username}. Items: ${wishlistData?.length || 0}`);
    } else {
      console.warn(`[recommendationService:${recommendationType}] Warning: Could not fetch wishlist data for user ${username}. Status: ${response.status}`);
    }
  } catch (error) {
    console.warn(`[recommendationService:${recommendationType}] Warning: Error fetching wishlist data for user ${username}:`, error.message);
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
              return `${product.name || 'Unknown Bottle'} (ID: ${product.id}${details ? `, Spirit: ${details.spirit}, Proof: ${details.proof}` : ''})`;
          })
          .filter(item => item !== null)
          .join('; ')
      : 'User bar is empty or data unavailable.';

  const wishlistSummary = wishlistData.length > 0
      ? wishlistData
          .slice(0, 20) // Limit summary size
          .map(item => {
              const product = item.product;
              if (!product || !product.id) return null;
              return `${product.name || 'Unknown Bottle'} (ID: ${product.id})`; // Simpler summary for wishlist
          })
          .filter(item => item !== null)
          .join('; ')
      : 'User wishlist is empty or unavailable.';

  const candidateSummary = recommendationCandidates
      .map(b => `${b.name} (ID: ${b.id}, Spirit: ${b.spirit}, Proof: ${b.proof})`)
      .join('; ');

  const focusInstruction = profileFocus
    ? `Pay special attention to the user's requested focus: "${profileFocus}". Ensure recommendations align with this focus if possible, while still matching the user's overall profile.`
    : `Recommend bottles with profiles similar to the user's existing collection.`;

  const prompt = `
System: You are an expert whisky recommender AI. Your goal is to suggest new whiskies to a user based on their existing collection profile, their wishlist, a specific profile focus (if provided), and a list of potential candidates.

User's Current Whisky Collection Summary (Owned Bottles - ID, Name, Spirit, Proof):
${ownedBottleSummary}
(Note: This might be a partial list if the user owns many bottles, or empty if none are owned)

User's Wishlist Summary (Bottles the user wants - ID, Name):
${wishlistSummary}
(Note: This might be a partial list if the user's wishlist is large)

Potential Recommendation Candidates (Bottles the user does NOT own - ID, Name, Spirit, Proof):
${candidateSummary}

Task:
Analyze the user's collection profile (considering spirit types, proofs, etc.) and their wishlist. ${focusInstruction}
From the 'Potential Recommendation Candidates' list, recommend ${NUM_RECOMMENDATIONS} whiskies that align with the user's likely profile preferences (and the specific focus, if provided).
Prioritize recommending items that are NOT in the user's collection and NOT on their wishlist.
Consider the user's wishlist for similarity and taste profile, but aim to suggest new discoveries that match the profile focus.
A maximum of 2-3 recommendations can be items directly from the user's wishlist if they strongly align with the user's profile/focus and complement potential new discoveries.
For each recommendation, provide its ID and a brief reasoning (1-2 sentences) explaining the profile similarity (and focus alignment, if applicable) and why the user might like it, considering both their collection and wishlist.

Output Format:
Return ONLY a valid JSON array containing ${NUM_RECOMMENDATIONS} objects, where each object has the following structure: {"id": <bottle_id>, "reasoning": "..."}. Do not include any other text, explanations, or markdown formatting like \`\`\`json ... \`\`\` outside the JSON array itself.
`;

  // --- Generate Recommendations using Helper ---
  let parsedRecommendations;
  try {
    console.log(`[recommendationService:${recommendationType}] Calling helper for user ${username}...`);
    parsedRecommendations = await generateRecommendationsCore(prompt, username, recommendationType);
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error getting recommendations for ${username}:`, error);
    throw new Error(`Failed to get profile-based recommendations for user ${username}. Details: ${error.message}`);
  }

  // --- LLM Hallucination Check ---
  const validParsedRecommendations = filterHallucinations(parsedRecommendations, recommendationCandidates, username, recommendationType);

  // --- Format Final Response ---
  // Include 'average_msrp' in the final output for profile recommendations
  const detailedRecommendations = mapRecommendationsToDetails(validParsedRecommendations, bottlesMap, username, recommendationType, ['avg_msrp']);

  console.log(`[recommendationService:${recommendationType}] Formatted ${detailedRecommendations.length} final recommendations for user ${username}.`);
  return detailedRecommendations;
};