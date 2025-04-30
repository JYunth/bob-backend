import express from 'express';
import cors from 'cors';
import config from '../config/index.js';
import recommendationRoutes from './routes/recommendationRoutes.js';

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all origins (adjust later if needed)
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api', recommendationRoutes);

// Root route for health check/info
app.get('/', (req, res) => {
  res.send('Bob Backend is running!');
});

// Export the app instance for use in index.js
export default app;