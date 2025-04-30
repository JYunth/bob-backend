// src/services/baxusClient.js
import fetch from 'node-fetch';
// import NodeCache from 'node-cache'; // Caching removed
import config from '../../config/index.js';

// Caching removed
// const baxusCache = new NodeCache({ stdTTL: 900, checkperiod: 60 });

/**
 * Fetches user bar data from the Baxus API.
 * @param {string} username - The username to fetch data for.
 * @returns {Promise<object>} - A promise that resolves with the user's bar data.
 * @throws {Error} - Throws an error if the API request fails or encounters network issues.
 */
export const getUserBar = async (username) => {
  if (!username || typeof username !== 'string') {
    throw new Error('Username must be a non-empty string.');
  }

  // Caching removed

  console.log(`Fetching user bar data for ${username} from API.`);
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

    // Caching removed

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