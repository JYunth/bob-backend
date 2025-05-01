// src/services/recommendation/constants.js

export const MAX_CANDIDATES = 100; // Limit the number of candidates sent to the LLM
export const NUM_RECOMMENDATIONS = 8; // Desired number of recommendations
export const MIN_CANDIDATES_FOR_DEFAULT_RANGE = 5; // Minimum candidates to aim for when widening default range
export const WIDENING_STEP_PERCENT = 0.10; // How much to widen the range each step (percentage of average price)
export const MAX_WIDENING_ATTEMPTS = 5; // Max times to widen the default range