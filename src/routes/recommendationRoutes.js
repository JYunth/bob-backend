// src/routes/recommendationRoutes.js
import express from 'express';
import { getRecommendations } from '../services/recommendationService.js';

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

export default router;