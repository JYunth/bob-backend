// src/services/recommendation/candidateUtils.js
import { MAX_CANDIDATES } from './constants.js';

/**
 * Extracts the set of owned bottle IDs from user's bar data.
 * @param {Array<object> | null | undefined} baxusData - User's bar data.
 * @returns {Set<number>} - A set containing the IDs of owned bottles.
 */
export const getOwnedBottleIds = (baxusData) => {
  if (!baxusData) {
    return new Set();
  }
  return new Set(baxusData.map(item => item.product?.id).filter(id => id != null));
};

/**
 * Filters potential recommendation candidates based on ownership and extracts specified fields.
 * @param {Set<number>} ownedBottleIds - Set of bottle IDs the user owns.
 * @param {Map<number, object>} bottlesMap - Map of all bottle details.
 * @param {number} [maxCandidates=MAX_CANDIDATES] - Maximum number of candidates to return.
 * @param {function(id: number, bottle: object): object} [fieldsExtractor=(id, bottle) => ({ id, name: bottle.name })] - Function to extract desired fields for each candidate.
 * @returns {Array<object>} - Array of candidate bottle objects.
 */
export const filterCandidates = (
  ownedBottleIds,
  bottlesMap,
  maxCandidates = MAX_CANDIDATES,
  fieldsExtractor = (id, bottle) => ({ id: id, name: bottle.name }) // Default extractor
) => {
  const candidates = [];
  for (const [id, bottle] of bottlesMap.entries()) {
    if (!ownedBottleIds.has(id)) {
      candidates.push(fieldsExtractor(id, bottle));
    }
    if (candidates.length >= maxCandidates) {
      break;
    }
  }
  return candidates;
};

/**
 * Checks LLM recommendations against the candidate list to filter out hallucinations.
 * @param {Array<object>} parsedRecommendations - Recommendations received from the LLM (should have 'id' property).
 * @param {Array<object>} recommendationCandidates - The list of candidates sent to the LLM (should have 'id' property).
 * @param {string} username - Username for logging.
 * @param {string} recommendationType - Type of recommendation for logging (e.g., 'general', 'price').
 * @returns {Array<object>} - Filtered list of valid recommendations.
 */
export const filterHallucinations = (parsedRecommendations, recommendationCandidates, username, recommendationType) => {
    if (!Array.isArray(parsedRecommendations)) {
        console.warn(`[recommendationService:candidateUtils:${recommendationType}] Invalid parsedRecommendations input for hallucination check for user ${username}. Expected array.`);
        return [];
    }
     if (!Array.isArray(recommendationCandidates)) {
        console.warn(`[recommendationService:candidateUtils:${recommendationType}] Invalid recommendationCandidates input for hallucination check for user ${username}. Expected array.`);
        // Decide how to handle: return empty or return original parsedRecommendations? Returning empty seems safer.
        return [];
    }

    const validParsedRecommendations = parsedRecommendations.filter(rec => {
        if (rec.id == null) {
            console.warn(`[recommendationService:candidateUtils:${recommendationType}] LLM returned a recommendation without an ID for user ${username}. Skipping.`);
            return false;
        }
        const isValid = recommendationCandidates.some(candidate => candidate.id === rec.id);
        if (!isValid) {
          console.warn(`[recommendationService:candidateUtils:${recommendationType}] LLM recommended bottle ID ${rec.id} which was not in the candidate list for user ${username}. Skipping.`);
        }
        return isValid;
      });

    console.log(`[recommendationService:candidateUtils:${recommendationType}] After hallucination check, ${validParsedRecommendations.length} valid recommendations remain for user ${username}.`);
    return validParsedRecommendations;
}

/**
 * Maps valid recommendation IDs to full bottle details and formats the final output.
 * @param {Array<object>} validParsedRecommendations - Recommendations filtered for hallucinations (must have 'id' and 'reasoning').
 * @param {Map<number, object>} bottlesMap - Map of all bottle details.
 * @param {string} username - Username for logging.
 * @param {string} recommendationType - Type of recommendation for logging.
 * @returns {Array<object>} - Array of detailed recommendation objects, including all fields from the bottle data.
 */
export const mapRecommendationsToDetails = (validParsedRecommendations, bottlesMap, username, recommendationType) => { // Removed extraFields parameter
    return validParsedRecommendations
      .map(rec => {
        // Basic validation already done in hallucination check, but double-check reasoning format.
        if (typeof rec.reasoning !== 'string') {
          console.warn(`[recommendationService:candidateUtils:${recommendationType}] Skipping recommendation with invalid reasoning format from LLM for ID ${rec.id} for user ${username}:`, rec);
          return null; // Skip invalid entries
        }

        const bottleDetails = bottlesMap.get(rec.id);

        if (bottleDetails) {
          // Spread all properties from bottleDetails and add/overwrite rationale
          const recommendation = {
            ...bottleDetails, // Include all fields from the enriched data
            rationale: rec.reasoning // Add the LLM's reasoning
          };

          // Ensure the ID from the recommendation record is used, in case bottleDetails lacks it (unlikely but safe)
          recommendation.id = rec.id;

          return recommendation;
        } else {
          // This case should ideally not happen due to the hallucination check
          console.error(`[recommendationService:candidateUtils:${recommendationType}] CRITICAL: Recommended bottle ID ${rec.id} passed hallucination check but was not found in bottlesMap for user ${username}. Data inconsistency?`);
          return null;
        }
      })
      .filter(rec => rec !== null); // Filter out null entries
}