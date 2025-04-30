// src/services/baxusClient.js
import fetch from 'node-fetch';
import NodeCache from 'node-cache'; // Import NodeCache
import config from '../../config/index.js';

// Initialize cache: TTL 900s (15 min), check period 60s
const baxusCache = new NodeCache({ stdTTL: 900, checkperiod: 60 }); // Updated TTL

/**
 * Fetches user bar data from the Baxus API, using an in-memory cache.
 * @param {string} username - The username to fetch data for.
 * @returns {Promise<object>} - A promise that resolves with the user's bar data.
 * @throws {Error} - Throws an error if the API request fails or encounters network issues.
 */
export const getUserBar = async (username) => {
  if (!username || typeof username !== 'string') {
    throw new Error('Username must be a non-empty string.');
  }

  const cacheKey = `baxus_bar_${username}`;
  try {
    const cachedData = baxusCache.get(cacheKey);

    if (cachedData !== undefined) { // Explicitly check for undefined, as null/false might be valid cached values
      console.log(`Cache hit for user bar data: ${username}`);
      return cachedData; // Return cached data immediately
    }
  } catch (error) {
      console.error(`Error retrieving data from cache for key ${cacheKey}:`, error);
      // Decide if we should proceed to fetch or throw, here we proceed
  }


  console.log(`Cache miss for user bar data: ${username}. Fetching from API.`);
  // Construct the API URL using the base URL from config and the username
  const apiUrl = `${config.baxusApiUrl}/bar/user/${username}`;
  console.log(`Fetching user bar data from: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      let errorBody = 'Could not read error body';
      try {
        errorBody = await response.text();
      } catch (readError) {
        console.error('Failed to read error response body:', readError);
      }
      const errorMessage = `Baxus API request failed for user '${username}' at URL '${apiUrl}'. Status: ${response.status}. Body: ${errorBody}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Cache the successful response before returning
    try {
        const success = baxusCache.set(cacheKey, data); // Check if set was successful
        if (success) {
            console.log(`Cached user bar data for: ${username}`);
        } else {
            // Log an error if caching failed. This might indicate issues with the data or cache instance.
            console.error(`Failed to cache user bar data for: ${username}. Cache key: ${cacheKey}. 'set' returned false.`);
        }
    } catch (error) {
        console.error(`Error setting data in cache for key ${cacheKey}:`, error);
        // Decide if we should throw or just log. Logging allows the function to return data even if caching fails.
    }


    return data;

  } catch (error) {
    console.error(`Failed to fetch user bar data for ${username}:`, error);
    // Do not cache errors
    if (error.message.startsWith('Baxus API request failed')) {
        throw error;
    } else {
        throw new Error(`Failed to fetch user bar data: ${error.message}`);
    }
  }
};