// src/services/recommendation/priceService.js
import fetch from 'node-fetch'; // Assuming node-fetch is available or use native fetch if Node version supports it
import { getUserBar } from '../baxusClient.js';
import { bottlesMap } from '../../utils/dataLoader.js'; // Adjusted path
import { generateRecommendationsCore } from './llmHelper.js';
import { calculateAverageBarPrice, filterCandidatesByPrice } from './priceUtils.js';
import { getOwnedBottleIds, filterHallucinations, mapRecommendationsToDetails } from './candidateUtils.js';
import { NUM_RECOMMENDATIONS, MIN_CANDIDATES_FOR_DEFAULT_RANGE, WIDENING_STEP_PERCENT, MAX_WIDENING_ATTEMPTS } from './constants.js';

/**
 * Generates whisky recommendations based on a price range.
 * @param {string} username - The Baxus username.
 * @param {number | string | null | undefined} minPriceInput - Minimum price input.
 * @param {number | string | null | undefined} maxPriceInput - Maximum price input.
 * @returns {Promise<Array<object>>} - A promise that resolves to an array of recommendation objects.
 * @throws {Error} - Throws an error if fetching data fails or logic encounters issues.
 */
export const getPriceRecommendations = async (username, minPriceInput, maxPriceInput) => {
  const recommendationType = 'price';
  console.log(`[recommendationService:${recommendationType}] Getting recommendations for user: ${username}, input range: ${minPriceInput}-${maxPriceInput}`);

  let baxusData;
  let wishlistData = []; // Initialize wishlistData
  try {
    baxusData = await getUserBar(username);
    console.log(`[recommendationService:${recommendationType}] Fetched bar data. Count: ${baxusData?.length ?? 0}`);
    // Proceed even if the bar is empty
  } catch (error) {
    console.error(`[recommendationService:${recommendationType}] Error fetching user bar data for ${username}:`, error);
    throw new Error(`Failed to fetch bar data for price-based recommendations for user ${username}.`);
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

  // --- Calculate Price Range & Filter Candidates ---
  let minPrice = parseFloat(minPriceInput);
  let maxPrice = parseFloat(maxPriceInput);
  let recommendationCandidates = [];
  const ownedBottleIds = getOwnedBottleIds(baxusData);
  console.log(`[recommendationService:${recommendationType}] User owns ${ownedBottleIds.size} unique product IDs.`);

  if (isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice <= minPrice) {
      console.log(`[recommendationService:${recommendationType}] Invalid or missing price range. Calculating default range.`);
      const averagePrice = calculateAverageBarPrice(baxusData, bottlesMap, username);

      if (averagePrice > 0) {
          // --- Dynamic Widening Logic ---
          let currentMinPrice = averagePrice * 0.5;
          let currentMaxPrice = averagePrice * 1.5;
          const minWidth = 30.00; // Ensure minimum $30 width

          // Adjust initial range for minimum width
          let currentWidth = currentMaxPrice - currentMinPrice;
          if (currentWidth < minWidth) {
              const deficit = minWidth - currentWidth;
              const expansion = deficit / 2;
              currentMinPrice = Math.max(0, currentMinPrice - expansion);
              currentMaxPrice = currentMaxPrice + expansion;
          }

          console.log(`[recommendationService:${recommendationType}] Initial default range: ${currentMinPrice.toFixed(2)} - ${currentMaxPrice.toFixed(2)}`);
          recommendationCandidates = filterCandidatesByPrice(ownedBottleIds, currentMinPrice, currentMaxPrice, bottlesMap);
          console.log(`[recommendationService:${recommendationType}] Found ${recommendationCandidates.length} candidates in initial range.`);

          let attempts = 0;
          while (recommendationCandidates.length < MIN_CANDIDATES_FOR_DEFAULT_RANGE && attempts < MAX_WIDENING_ATTEMPTS) {
              attempts++;
              const wideningAmount = averagePrice * WIDENING_STEP_PERCENT;
              currentMinPrice = Math.max(0, currentMinPrice - (wideningAmount / 2));
              currentMaxPrice = currentMaxPrice + (wideningAmount / 2);
              console.log(`[recommendationService:${recommendationType}] Widening attempt ${attempts}: New range ${currentMinPrice.toFixed(2)} - ${currentMaxPrice.toFixed(2)}`);

              recommendationCandidates = filterCandidatesByPrice(ownedBottleIds, currentMinPrice, currentMaxPrice, bottlesMap);
              console.log(`[recommendationService:${recommendationType}] Found ${recommendationCandidates.length} candidates after widening attempt ${attempts}.`);
          }

          if (recommendationCandidates.length < MIN_CANDIDATES_FOR_DEFAULT_RANGE) {
              console.warn(`[recommendationService:${recommendationType}] Could not find sufficient candidates (${MIN_CANDIDATES_FOR_DEFAULT_RANGE}) after ${MAX_WIDENING_ATTEMPTS} attempts. Proceeding with ${recommendationCandidates.length}.`);
          }

          minPrice = currentMinPrice; // Set the final range used
          maxPrice = currentMaxPrice;
          // --- End Dynamic Widening ---

      } else {
          console.warn(`[recommendationService:${recommendationType}] Cannot determine default price range for user ${username}. No valid prices in bar and no range provided.`);
          return [];
      }
  } else {
      // Use provided range
      console.log(`[recommendationService:${recommendationType}] Using provided price range for ${username}: ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`);
      recommendationCandidates = filterCandidatesByPrice(ownedBottleIds, minPrice, maxPrice, bottlesMap);
      console.log(`[recommendationService:${recommendationType}] Filtered down to ${recommendationCandidates.length} candidates within provided price range.`);
  }

  // Final check for candidates
  if (recommendationCandidates.length === 0) {
      console.warn(`[recommendationService:${recommendationType}] No candidates found within the final price range (${minPrice.toFixed(2)}-${maxPrice.toFixed(2)}) for user ${username}.`);
      return [];
  }

  // --- Prompt Construction ---
  const ownedBottleSummary = baxusData
      ?.slice(0, 20)
      .map(item => `${item.product?.name || 'Unknown Bottle'} (ID: ${item.product?.id})`)
      .filter(item => item.includes('ID: ') && !item.includes('ID: null'))
      .join(', ') || 'None (or data unavailable)';

  const wishlistSummary = wishlistData.length > 0
      ? wishlistData
          .slice(0, 20) // Limit summary size
          .map(item => `${item.product?.name || 'Unknown Bottle'} (ID: ${item.product?.id})`)
          .filter(item => item.includes('ID: ') && !item.includes('ID: null')) // Ensure ID exists for summary
          .join(', ')
      : 'User wishlist is empty or unavailable.';

  // Candidate summary includes fair_price from filterCandidatesByPrice
  const candidateSummary = recommendationCandidates.map(b => `${b.name} (ID: ${b.id}, Fair Price: $${b.price?.toFixed(2)})`).join('; ');

  const prompt = `
System: You are an expert whisky recommender AI. Your goal is to suggest new whiskies to a user based on their existing collection, their wishlist, and a list of potential candidates filtered by a specific price range (using Fair Price).

User's Current Whisky Collection Summary (Owned Bottle IDs and Names):
${ownedBottleSummary}
(Note: This might be a partial list or unavailable if the user's bar is empty/private)

User's Wishlist Summary (Bottles the user wants but may not own):
${wishlistSummary}
(Note: This might be a partial list if the user's wishlist is large)

Target Price Range for Recommendations:
Minimum Price: $${minPrice.toFixed(2)}
Maximum Price: $${maxPrice.toFixed(2)}

Potential Recommendation Candidates (Bottles the user does NOT own AND are within the target Fair Price range):
${candidateSummary}

Task:
Based on the user's collection (if available), their wishlist, and the provided candidates within the Fair Price range $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}, recommend ${NUM_RECOMMENDATIONS} whiskies from the 'Potential Recommendation Candidates' list.
Prioritize recommending items that fit the Fair Price range well AND are NOT in the user's collection and NOT on their wishlist.
Consider the user's wishlist for similarity and taste profile, but aim to suggest new discoveries within the price range.
A maximum of 2-3 recommendations can be items directly from the user's wishlist if they strongly align with the user's profile, fit the price range, and complement potential new discoveries.
For each recommendation, provide a brief reasoning (1-2 sentences) explaining why it's a good fit, mentioning the Fair Price aspect and its relation to the user's collection/wishlist if relevant.

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
    throw new Error(`Failed to get price-based recommendations for user ${username}. Details: ${error.message}`);
  }

  // --- LLM Hallucination Check ---
  const validParsedRecommendations = filterHallucinations(parsedRecommendations, recommendationCandidates, username, recommendationType);

  // --- Format Final Response ---
  // Include 'fair_price' in the final output for price recommendations
  const detailedRecommendations = mapRecommendationsToDetails(validParsedRecommendations, bottlesMap, username, recommendationType, ['fair_price']);


  console.log(`[recommendationService:${recommendationType}] Formatted ${detailedRecommendations.length} final recommendations for user ${username}.`);
  return detailedRecommendations;
};