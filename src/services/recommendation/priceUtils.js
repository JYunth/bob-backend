// src/services/recommendation/priceUtils.js
import { MAX_CANDIDATES } from './constants.js';

/**
 * Helper function to calculate the average price of bottles in the user's bar.
 * Uses price priority: avg_msrp > fair_price > shelf_price
 * @param {Array<object>} baxusData - User's bar data.
 * @param {Map<number, object>} bottlesMap - Map of all bottle details.
 * @param {string} username - The username for logging.
 * @returns {number} - The calculated average price, or 0 if not possible.
 */
export const calculateAverageBarPrice = (baxusData, bottlesMap, username) => {
  let totalPrice = 0;
  let validBottleCount = 0;

  if (!baxusData || baxusData.length === 0) {
    console.log(`[recommendationService:priceUtils] User ${username}'s bar data is empty or unavailable for average price calculation.`);
    return 0; // No data, no average price
  }

  for (const item of baxusData) {
    const productId = item.product?.id;
    if (productId) {
      const bottleDetails = bottlesMap.get(productId);
      if (bottleDetails) {
        let price = null;
        // Price priority logic
        if (bottleDetails.avg_msrp != null && typeof bottleDetails.avg_msrp === 'number' && !isNaN(bottleDetails.avg_msrp) && bottleDetails.avg_msrp > 0) {
          price = bottleDetails.avg_msrp;
        } else if (bottleDetails.fair_price != null && typeof bottleDetails.fair_price === 'number' && !isNaN(bottleDetails.fair_price) && bottleDetails.fair_price > 0) {
          price = bottleDetails.fair_price;
        } else if (bottleDetails.shelf_price != null && typeof bottleDetails.shelf_price === 'number' && !isNaN(bottleDetails.shelf_price) && bottleDetails.shelf_price > 0) {
          price = bottleDetails.shelf_price;
        }

        if (price !== null) {
          totalPrice += price;
          validBottleCount++;
        }
      }
    }
  }

  if (validBottleCount === 0) {
    // Log with username for better context
    console.warn(`[recommendationService:priceUtils] Could not calculate average bar price: No valid prices found for user ${username}.`);
    return 0; // Return 0 if no valid prices found
  }

  const averagePrice = totalPrice / validBottleCount;
  console.log(`[recommendationService:priceUtils] Calculated average bar price for ${username}: ${averagePrice.toFixed(2)} from ${validBottleCount} bottles.`);
  return averagePrice;
};


/**
 * Filters potential recommendation candidates based on ownership and price range.
 * @param {Set<number>} ownedBottleIds - Set of bottle IDs the user owns.
 * @param {number} minPrice - Minimum price for filtering.
 * @param {number} maxPrice - Maximum price for filtering.
 * @param {Map<number, object>} bottlesMap - Map of all bottle details.
 * @returns {Array<object>} - Array of candidate bottles within the price range.
 */
export const filterCandidatesByPrice = (ownedBottleIds, minPrice, maxPrice, bottlesMap) => {
  const candidates = [];
  for (const [id, bottle] of bottlesMap.entries()) {
    // Check ownership
    if (ownedBottleIds.has(id)) {
      continue;
    }

    // Check price range using fair_price
    const price = bottle.fair_price; // Using fair_price as per original logic
    if (price != null && typeof price === 'number' && !isNaN(price) && price >= minPrice && price <= maxPrice) {
      candidates.push({
          id: id,
          name: bottle.name,
          price: price // Include fair_price for LLM context
      });
    }

    if (candidates.length >= MAX_CANDIDATES) {
      break; // Stop if we hit the overall candidate limit
    }
  }
  return candidates;
};