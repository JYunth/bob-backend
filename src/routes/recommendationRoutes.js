// src/routes/recommendationRoutes.js
import express from 'express';
import { getRecommendations, getRecommendationsByPrice, getRecommendationsByProfile, getComplementaryRecommendations } from '../services/recommendation/index.js';

const router = express.Router();

// GET /user/:username - Get recommendations for a specific user
router.get('/user/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const result = await getRecommendations(username);
    res.json({ recommendations: result });
  } catch (error) {
    console.error(`Error fetching recommendations for user ${username}:`, error);

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

  try {
    const result = await getRecommendationsByPrice(username, minPrice, maxPrice);
    res.json({ recommendations: result });
  } catch (error) {
    console.error(`Error fetching price-based recommendations for user ${username}:`, error);

    // Determine appropriate status code
    let statusCode = 500;
    // Example: Check if the error indicates user not found (adjust based on actual error from service)
    // if (error.message.includes('User not found')) { // Assuming service throws specific error
    //   statusCode = 404;
    // }

    res.status(statusCode).json({
      error: 'Failed to get price-based recommendations',
      details: error.message, // Provide error message for debugging/info
    });
  }
});

// New route for similar-profile recommendations
router.get('/user/:username/similar-profile', async (req, res) => {
  const { username } = req.params;
  const { focus } = req.query; // Optional query param

  try {
    const result = await getRecommendationsByProfile(username, focus);
    res.json({ recommendations: result });
  } catch (error) {
    console.error(`Error fetching profile-based recommendations for user ${username}:`, error);
    // Determine appropriate status code
    let statusCode = 500;
    // Add specific error handling if needed, e.g., 404 for user not found
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    // }
    res.status(statusCode).json({
      error: 'Failed to get profile-based recommendations',
      details: error.message,
    });
  }
});

// New route for complementary recommendations
router.get('/user/:username/complementary', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await getComplementaryRecommendations(username);
    res.json({ recommendations: result });
  } catch (error) {
    console.error(`Error fetching complementary recommendations for user ${username}:`, error);
    // Determine appropriate status code
    let statusCode = 500;
    // Add specific error handling if needed, e.g., 404 for user not found
    // if (error.message.includes('User not found')) {
    //   statusCode = 404;
    // }
    res.status(statusCode).json({
      error: 'Failed to get complementary recommendations',
      details: error.message,
    });
  }
});
export default router;