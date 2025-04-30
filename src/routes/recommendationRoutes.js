// src/routes/recommendationRoutes.js
import express from 'express';
import NodeCache from 'node-cache'; // Import NodeCache
import { getRecommendations, getRecommendationsByPrice, getRecommendationsByProfile, getComplementaryRecommendations } from '../services/recommendation/index.js';

// Initialize cache for recommendations: TTL 900s (15 min), check period 120s
const recommendationCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const router = express.Router();

// GET /user/:username - Get recommendations for a specific user
router.get('/user/:username', async (req, res) => {
  const { username } = req.params;

  const cacheKey = `recommendations_${username}`;

  try {
    // 1. Check cache first
    const cachedData = recommendationCache.get(cacheKey);
    if (cachedData !== undefined) {
      console.log(`Cache hit for recommendations: ${username}`);
      return res.json(cachedData); // Return cached data directly
    }

    console.log(`Cache miss for recommendations: ${username}. Fetching...`);
    // 2. If cache miss, fetch data
    const result = await getRecommendations(username);
    const responseData = { recommendations: result };

    // 3. Cache the successful result before sending
    try {
        const success = recommendationCache.set(cacheKey, responseData);
        if (success) {
            console.log(`Cached recommendations for: ${username}`);
        } else {
            console.error(`Failed to cache recommendations for: ${username}. Cache key: ${cacheKey}.`);
        }
    } catch (cacheError) {
        console.error(`Error setting recommendations in cache for key ${cacheKey}:`, cacheError);
    }

    // 4. Send the response
    res.json(responseData);

  } catch (error) {
    // This catch block now handles errors from getRecommendations or cache.get
    console.error(`Error processing recommendations request for user ${username}:`, error);

    // Basic error handling - could be refined based on specific error types
    let statusCode = 500;
    let errorMessage = 'Failed to get recommendations';

    // Example: Check if the error indicates user not found (adjust based on actual error from service)
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    //   errorMessage = `User '${username}' not found.`;
    // }

    res.status(statusCode).json({ error: errorMessage, details: error.message });
  }
});

// New route for similar-price recommendations
router.get('/user/:username/similar-price', async (req, res) => {
  const { username } = req.params;
  // Extract and potentially parse price query parameters
  const minPrice = req.query.min_price ? parseFloat(req.query.min_price) : undefined;
  const maxPrice = req.query.max_price ? parseFloat(req.query.max_price) : undefined;

  // Validate parsed numbers if necessary (e.g., check for NaN)
  // For simplicity, we'll let the service handle potentially invalid inputs for now

  // Construct cache key, handling undefined prices
  const cacheKey = `recs_price_${username}_min${minPrice ?? 'any'}_max${maxPrice ?? 'any'}`;

  try {
    // 1. Check cache first
    let cachedData;
    try {
        cachedData = recommendationCache.get(cacheKey);
    } catch (cacheError) {
        console.error(`Error getting price recommendations from cache for key ${cacheKey}:`, cacheError);
        // Decide if we should proceed without cache or return an error
        // For now, let's proceed as if it's a cache miss, but log the error
        cachedData = undefined;
    }

    if (cachedData !== undefined) {
      console.log(`Cache hit for price recommendations: ${username} (min: ${minPrice ?? 'any'}, max: ${maxPrice ?? 'any'})`);
      return res.json(cachedData); // Return cached data directly
    }

    console.log(`Cache miss for price recommendations: ${username} (min: ${minPrice ?? 'any'}, max: ${maxPrice ?? 'any'}). Fetching...`);
    // 2. If cache miss, fetch data
    const result = await getRecommendationsByPrice(username, minPrice, maxPrice);
    const responseData = { recommendations: result };

    // 3. Cache the successful result before sending
    try {
        const success = recommendationCache.set(cacheKey, responseData);
        if (success) {
            console.log(`Cached price recommendations for: ${username} (min: ${minPrice ?? 'any'}, max: ${maxPrice ?? 'any'})`);
        } else {
            console.error(`Failed to cache price recommendations for: ${username}. Cache key: ${cacheKey}.`);
        }
    } catch (cacheError) {
        console.error(`Error setting price recommendations in cache for key ${cacheKey}:`, cacheError);
    }

    // 4. Send the response
    res.json(responseData);

  } catch (error) {
    // This catch block handles errors from getRecommendationsByPrice or potentially cache.get if not handled above
    console.error(`Error processing price recommendations request for user ${username}:`, error);

    // Basic error handling
    let statusCode = 500;
    let errorMessage = 'Failed to get price-based recommendations';

    // Add specific error handling if needed
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    //   errorMessage = `User '${username}' not found.`;
    // }

    res.status(statusCode).json({ error: errorMessage, details: error.message });
  }
});

// New route for similar-profile recommendations
router.get('/user/:username/similar-profile', async (req, res) => {
  const { username } = req.params;
  const { focus } = req.query; // Optional query param

  // Construct cache key, handling undefined focus
  const cacheKey = `recs_profile_${username}_focus${focus || 'any'}`;

  try {
    // 1. Check cache first
    let cachedData;
     try {
        cachedData = recommendationCache.get(cacheKey);
    } catch (cacheError) {
        console.error(`Error getting profile recommendations from cache for key ${cacheKey}:`, cacheError);
        cachedData = undefined; // Proceed as cache miss
    }

    if (cachedData !== undefined) {
      console.log(`Cache hit for profile recommendations: ${username} (focus: ${focus || 'any'})`);
      return res.json(cachedData); // Return cached data directly
    }

    console.log(`Cache miss for profile recommendations: ${username} (focus: ${focus || 'any'}). Fetching...`);
    // 2. If cache miss, fetch data
    const result = await getRecommendationsByProfile(username, focus);
    const responseData = { recommendations: result };

    // 3. Cache the successful result before sending
    try {
        const success = recommendationCache.set(cacheKey, responseData);
        if (success) {
            console.log(`Cached profile recommendations for: ${username} (focus: ${focus || 'any'})`);
        } else {
            console.error(`Failed to cache profile recommendations for: ${username}. Cache key: ${cacheKey}.`);
        }
    } catch (cacheError) {
        console.error(`Error setting profile recommendations in cache for key ${cacheKey}:`, cacheError);
    }

    // 4. Send the response
    res.json(responseData);

  } catch (error) {
    // This catch block handles errors from getRecommendationsByProfile or cache operations
    console.error(`Error processing profile recommendations request for user ${username}:`, error);

    // Basic error handling
    let statusCode = 500;
    let errorMessage = 'Failed to get profile-based recommendations';

    // Add specific error handling if needed
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    //   errorMessage = `User '${username}' not found.`;
    // }

    res.status(statusCode).json({ error: errorMessage, details: error.message });
  }
});

// New route for complementary recommendations
router.get('/user/:username/complementary', async (req, res) => {
  const { username } = req.params;
  // Construct cache key
  const cacheKey = `recs_comp_${username}`;

  try {
    // 1. Check cache first
    let cachedData;
    try {
        cachedData = recommendationCache.get(cacheKey);
    } catch (cacheError) {
        console.error(`Error getting complementary recommendations from cache for key ${cacheKey}:`, cacheError);
        cachedData = undefined; // Proceed as cache miss
    }


    if (cachedData !== undefined) {
      console.log(`Cache hit for complementary recommendations: ${username}`);
      return res.json(cachedData); // Return cached data directly
    }

    console.log(`Cache miss for complementary recommendations: ${username}. Fetching...`);
    // 2. If cache miss, fetch data
    const result = await getComplementaryRecommendations(username);
    const responseData = { recommendations: result };

    // 3. Cache the successful result before sending
    try {
        const success = recommendationCache.set(cacheKey, responseData);
        if (success) {
            console.log(`Cached complementary recommendations for: ${username}`);
        } else {
            console.error(`Failed to cache complementary recommendations for: ${username}. Cache key: ${cacheKey}.`);
        }
    } catch (cacheError) {
        console.error(`Error setting complementary recommendations in cache for key ${cacheKey}:`, cacheError);
    }

    // 4. Send the response
    res.json(responseData);

  } catch (error) {
    // This catch block handles errors from getComplementaryRecommendations or cache operations
    console.error(`Error processing complementary recommendations request for user ${username}:`, error);

    // Basic error handling
    let statusCode = 500;
    let errorMessage = 'Failed to get complementary recommendations';

    // Add specific error handling if needed
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    //   errorMessage = `User '${username}' not found.`;
    // }

    res.status(statusCode).json({ error: errorMessage, details: error.message });
  }
});
export default router;