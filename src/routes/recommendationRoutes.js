// src/routes/recommendationRoutes.js
import express from 'express';
import NodeCache from 'node-cache'; // Import NodeCache
import { getRecommendations, getRecommendationsByPrice, getRecommendationsByProfile, getComplementaryRecommendations } from '../services/recommendation/index.js';

// Initialize cache for recommendations: TTL 120s (2 min), check period 120s
const recommendationCache = new NodeCache({ stdTTL: 120, checkperiod: 120 });

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
// --- Proxy Endpoints ---

// Import necessary functions and config
import { getUserBar } from '../services/baxusClient.js';
import fetch from 'node-fetch'; // Ensure fetch is available if not already imported globally
import config from '../../config/index.js';

// GET /api/proxy/bar/:username - Proxy for Baxus user bar data
router.get('/api/proxy/bar/:username', async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required.' });
  }

  console.log(`Proxy request received for bar data: ${username}`);

  try {
    const barData = await getUserBar(username);
    console.log(`Successfully fetched bar data for ${username} via proxy.`);
    res.json(barData);
  } catch (error) {
    console.error(`Error proxying bar data request for user ${username}:`, error);
    // Determine appropriate status code based on the error
    let statusCode = 500;
    let errorMessage = 'Failed to fetch user bar data via proxy.';
    if (error.message.includes('Baxus API request failed')) {
        // Try to parse the status from the original error if possible
        const statusMatch = error.message.match(/Status: (\d+)/);
        if (statusMatch && statusMatch[1]) {
            statusCode = parseInt(statusMatch[1], 10);
        } else {
            statusCode = 502; // Bad Gateway if upstream failed without specific status
        }
        errorMessage = `Upstream Baxus API error for bar data: ${error.message}`;
    } else if (error.message.includes('Username must be a non-empty string')) {
        statusCode = 400; // Bad Request from our validation
        errorMessage = error.message;
    }
    // Ensure we don't send a massive error message back if the body was included
    const cleanErrorMessage = errorMessage.split(' Body: ')[0];
    res.status(statusCode).json({ error: cleanErrorMessage, details: error.message });
  }
});

// GET /api/proxy/wishlist/:username - Proxy for Baxus user wishlist data
router.get('/api/proxy/wishlist/:username', async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ error: 'Username parameter is required.' });
  }

  const wishlistUrl = `${config.baxusApiUrl}/wishlist/user/${username}`;
  console.log(`Proxy request received for wishlist data: ${username}. Fetching from: ${wishlistUrl}`);

  try {
    const response = await fetch(wishlistUrl);

    if (!response.ok) {
      let errorBody = 'Could not read error body';
      try {
        errorBody = await response.text();
      } catch (readError) {
        console.error('Failed to read error response body for wishlist proxy:', readError);
      }
      const errorMessage = `Baxus Wishlist API request failed for user '${username}' at URL '${wishlistUrl}'. Status: ${response.status}. Body: ${errorBody}`;
      console.error(errorMessage);
      // Don't include potentially large/sensitive body in client response
      res.status(response.status).json({ error: `Upstream Baxus API error for wishlist data. Status: ${response.status}` });
      return; // Stop execution after sending error response
    }

    const wishlistData = await response.json();
    console.log(`Successfully fetched wishlist data for ${username} via proxy.`);
    res.json(wishlistData);

  } catch (error) {
    console.error(`Error proxying wishlist data request for user ${username}:`, error);
    // Network errors or other issues with fetch itself
    res.status(502).json({ error: 'Failed to fetch user wishlist data via proxy due to network or other error.', details: error.message });
  }
});
export default router;