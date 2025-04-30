import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Centralized configuration
const config = {
  googleApiKey: process.env.GOOGLE_API_KEY,
  baxusApiUrl: process.env.BAXUS_API_URL || 'https://services.baxus.co/api', // Default if not set
  port: process.env.PORT || 3000, // Default port
  llmModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest' // Use a more general env var
};

// Validate essential configuration
if (!config.googleApiKey) {
  console.warn("Warning: GOOGLE_API_KEY environment variable is not set.");
  // Depending on the app's requirements, you might want to throw an error here
  // throw new Error("Missing essential configuration: GOOGLE_API_KEY");
}

export default config;