import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs'; // Import the file system module

// Load environment variables from .env file
dotenv.config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001"});

// Read the processing.json data once when the server starts
let processingDataContent = '';
try {
  processingDataContent = fs.readFileSync('processing.json', 'utf8');
  // Optional: Parse it if needed elsewhere, but for the prompt, string is fine.
  // const processingDataJson = JSON.parse(processingDataContent);
} catch (err) {
  console.error("Error reading processing.json:", err);
  // Handle error appropriately - maybe the server shouldn't start,
  // or use a default empty dataset for the prompt.
  // For now, we'll proceed with empty content if reading fails.
}


const app = express();
const port = 3000;

// Use cors middleware to enable CORS
app.use(cors());

app.get('/api/user/:username', async (req, res) => {
  const username = req.params.username;
  const apiUrl = `https://services.baxus.co/api/bar/user/${username}`;

  try {
    // 1. Fetch data from Baxus API
    const baxusResponse = await fetch(apiUrl);
    if (!baxusResponse.ok) {
      // Forward the status code from the Baxus API if available
      const errorBody = await baxusResponse.text();
      console.error(`Baxus API request failed with status ${baxusResponse.status}: ${errorBody}`);
      return res.status(baxusResponse.status).json({ error: `Baxus API request failed: ${errorBody}` });
    }
    const baxusData = await baxusResponse.json();

    // 2. Extract only bottle IDs for processing
    // Access the array within the main object and map over it
    // Map directly over baxusData (which is the array) to extract product IDs
    const user_processing = baxusData.map(bottle => ({ id: bottle.product?.id })); // Keep optional chaining for product just in case
    const userProcessingString = JSON.stringify(user_processing, null, 2); // Stringify the array of IDs

    // 3. Prepare prompt for Gemini using only the IDs
    // 3. Construct the new prompt for Gemini
    const prompt = `System prompt: You are an expert whisky recommender AI. You have a slightly snarky and funny personality.
Available Whisky Dataset: ${processingDataContent}
User's Current Collection: ${userProcessingString}

Task:
1.  **Analyze the User's Collection**: Identify patterns in the user's preferences based on their current collection (e.g., spirit types like Bourbon, Rye, Scotch; ABV ranges; fair price points; popularity based on wishlist/bar counts; rankings).
2.  **Generate Recommendations**: Suggest exactly 5 distinct bottles from the Available Whisky Dataset that the user does not already own.
3.  **Recommendation Logic**: Prioritize recommendations based on the following, in order of importance:
    *   **Similar Profiles**: Recommend bottles with characteristics (spirit type, ABV, price range, score/ranking) similar to those the user seems to prefer based on their collection analysis.
    *   **Complementary Diversification**: Suggest bottles that would complement the user's existing collection by introducing related but different styles or profiles (e.g., a different type of Bourbon if they have many similar ones, or a well-regarded Rye if they only have Bourbon).
    *   **Value/Popularity**: Consider bottles with high scores/rankings or popularity (wishlist/bar counts) within the user's likely preferred price range.
4.  **Ordering**: Arrange the 5 recommended bottles in descending order of relevance based on the analysis and recommendation logic above (most relevant first).
5.  **Output Format**: Respond ONLY with a valid JSON array containing 8 objects. Each object must have the following structure: {"id": <ID of the recommended bottle (number)>, "reasoning": "<A concise, single-line explanation for the recommendation based on the user's collection analysis and the bottle's characteristics>"}. Do NOT use markdown formatting (like \`\`\`json). Do NOT include newline characters (\\n) within the JSON structure itself.
6.  **Style of responses**: The reasoning should be snarky and funny, but still informative. Avoid overly technical jargon. Use a conversational tone that reflects your personality as an expert whisky recommender AI.
Example Output Structure:
[
  {"id": 123, "reasoning": "This one's got quite the similar high-ABV Bourbon profile to your preference, but its higher ranked."},
  {"id": 456, "reasoning": "A complementary Rye to diversify your Bourbon-heavy collection within a similar price range."},
  {"id": 789, "reasoning": "This is a popular and well-priced Bourbon matching your typical ABV range. You'll love it!"},
  {"id": 101, "reasoning": "This one's a highly wishlisted Bourbon offering a slightly different style."},
  {"id": 112, "reasoning": "Value option matches your preferred spirit type."}
]

Generate the JSON response now.`;

    // 4. Call Gemini API
    const result = await model.generateContent(prompt);
    const geminiResponse = await result.response;
    const geminiText = geminiResponse.text();

    // 5. Clean and parse Gemini's response
    let cleanedJson = null;
    let cleaningError = null;
    try {
      // Remove markdown markers and newlines
      const cleanedString = geminiText
        .replace(/^```json\s*/, '') // Remove starting ```json marker and any leading whitespace/newline
        .replace(/```$/, '')       // Remove ending ``` marker
        .trim();                   // Trim any extra whitespace from start/end

      cleanedJson = JSON.parse(cleanedString);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      console.error('Original Gemini text:', geminiText); // Log the original text for debugging
      cleaningError = 'Failed to parse AI response as JSON.';
      // Keep geminiText to potentially return the raw string if parsing fails
    }

    // 6. Send the cleaned JSON response (or error/raw text)
    if (cleanedJson) {
        res.json({ recommendations: cleanedJson });
    } else {
        // Optionally return the raw text if parsing failed, or just the error
        res.status(500).json({ error: cleaningError || 'Failed to process AI response', rawResponse: geminiText, processingData: user_processing, baxusData: baxusData });
    }


  } catch (error) {
    console.error('Error processing request:', error);
    // Differentiate between Baxus API errors (handled above) and other errors (e.g., Gemini API, network issues)
    if (error.message.includes('Baxus API request failed')) {
        // Error already sent
    } else if (error.message.includes('GoogleGenerativeAI Error')) {
        res.status(500).json({ error: 'Failed to get response from AI model' });
    }
     else {
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
  }
});

app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});