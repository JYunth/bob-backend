// src/services/recommendation/index.js

// Re-export the specific recommendation functions under their original names
// to maintain the API contract with the routes.

import { getGeneralRecommendations } from './generalService.js';
import { getPriceRecommendations } from './priceService.js';
import { getProfileRecommendations } from './profileService.js';
import { getComplementaryRecommendations as getComplementaryRecs } from './complementaryService.js'; // Alias to avoid potential naming conflicts if needed elsewhere, though routes use specific names

// Export functions with the names expected by recommendationRoutes.js
export const getRecommendations = getGeneralRecommendations;
export const getRecommendationsByPrice = getPriceRecommendations;
export const getRecommendationsByProfile = getProfileRecommendations;
export const getComplementaryRecommendations = getComplementaryRecs; // Export with the original name

// You could also export them like this if preferred:
// export { getGeneralRecommendations as getRecommendations } from './generalService.js';
// export { getPriceRecommendations as getRecommendationsByPrice } from './priceService.js';
// export { getProfileRecommendations as getRecommendationsByProfile } from './profileService.js';
// export { getComplementaryRecommendations } from './complementaryService.js';