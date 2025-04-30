// src/services/baxusClient.js
import fetch from 'node-fetch';
import config from '../../config/index.js';

/**
 * Fetches user bar data from the Baxus API.
 * @param {string} username - The username to fetch data for.
 * @returns {Promise<object>} - A promise that resolves with the user's bar data.
 * @throws {Error} - Throws an error if the API request fails or encounters network issues.
 */
export const getUserBar = async (username) => {
  if (!username || typeof username !== 'string') {
    // Added basic validation for username
    throw new Error('Username must be a non-empty string.');
  }

  // Construct the API URL using the base URL from config and the username
  // Assuming the endpoint structure is /users/{username}/bar - adjust if different
  const apiUrl = `${config.baxusApiUrl}/bar/user/${username}`;
  console.log(`Fetching user bar data from: ${apiUrl}`); // Added logging for debugging

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      let errorBody = 'Could not read error body';
      try {
        // Attempt to read the response body as text first
        errorBody = await response.text();
      } catch (readError) {
        console.error('Failed to read error response body:', readError);
      }
      // Log a more detailed error including username, URL, status, and body
      const errorMessage = `Baxus API request failed for user '${username}' at URL '${apiUrl}'. Status: ${response.status}. Body: ${errorBody}`;
      console.error(errorMessage);
      throw new Error(errorMessage); // Throw the specific error, including details
    }

    // If response is OK, parse the JSON body
    const data = await response.json();
    return data;

  } catch (error) {
    // Catch network errors or errors thrown from the !response.ok block
    console.error(`Failed to fetch user bar data for ${username}:`, error);

    // Re-throw a new error with a user-friendly message, including the original error's message
    // Avoid re-throwing the exact same error if it was already the specific API error
    if (error.message.startsWith('Baxus API request failed')) {
        throw error; // Re-throw the specific API error directly
    } else {
        throw new Error(`Failed to fetch user bar data: ${error.message}`);
    }
  }
};