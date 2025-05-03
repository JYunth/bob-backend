# Bob Backend - Whisky Recommendation API

## Description

Bob Backend is a Node.js application that provides personalized whisky recommendations. It leverages user collection data from the Baxus platform and utilizes Google's Generative AI (Gemini) to generate tailored suggestions based on various criteria like user preferences, price range, taste profile, and collection diversity.

## Features

*   **Multiple Recommendation Strategies:**
    *   **General:** Recommends whiskies based on the user's overall collection.
    *   **Price-Based:** Recommends whiskies within a specific price range (user-defined or calculated based on the user's collection average).
    *   **Profile-Based:** Recommends whiskies similar to the user's taste profile, optionally focusing on specific characteristics (e.g., 'peaty', 'sherry').
    *   **Complementary:** Recommends whiskies that diversify the user's existing collection by suggesting different styles, regions, or profiles.
*   **External Data Integration:** Fetches user whisky collection data from the Baxus API.
*   **AI-Powered Recommendations:** Uses Google's Generative AI models to analyze user data and generate relevant recommendations with reasoning.
*   **Data-Driven:** Relies on a local `bottles.json` file containing details about various whiskies.
*   **Caching:** Implements in-memory caching for recommendation results to improve performance for repeated requests.

## Technology Stack

*   **Backend:** Node.js, Express.js
*   **AI:** Google Generative AI (Gemini models via `@google/generative-ai`)
*   **API Client:** `node-fetch` (for Baxus API)
*   **Caching:** `node-cache`
*   **Configuration:** `dotenv`
*   **Package Manager:** npm

## Project Structure

```
.
├── config/
│   └── index.js           # Loads environment variables and centralizes configuration
├── src/
│   ├── routes/
│   │   └── recommendationRoutes.js # Defines API endpoints for recommendations
│   ├── services/
│   │   ├── recommendation/  # Core recommendation logic
│   │   │   ├── candidateUtils.js # Helpers for filtering candidates, checking hallucinations, formatting
│   │   │   ├── complementaryService.js # Logic for complementary recommendations
│   │   │   ├── constants.js      # Shared constants for recommendation logic
│   │   │   ├── generalService.js   # Logic for general recommendations
│   │   │   ├── index.js          # Exports recommendation service functions
│   │   │   ├── llmHelper.js      # Wrapper for LLM calls and response parsing
│   │   │   ├── priceService.js     # Logic for price-based recommendations
│   │   │   ├── priceUtils.js     # Helpers for price calculations and filtering
│   │   │   └── profileService.js   # Logic for profile-based recommendations
│   │   ├── baxusClient.js     # Client for interacting with the Baxus API
│   │   └── llmClient.js       # Client for interacting with Google Generative AI
│   └── utils/
│       └── dataLoader.js    # Loads and maps bottle data from bottles.json
│   └── server.js          # Express application setup (middleware, routes)
├── .env.example           # Example environment variables file
├── .gitignore             # Specifies intentionally untracked files
├── bottles.json           # Master data file for whisky bottles (Needs to be created/provided)
├── index.js               # Application entry point - starts the server
├── package.json           # Project metadata and dependencies
└── README.md              # This file
```

## Setup and Installation

**Prerequisites:**

*   Node.js (v18 or later recommended)
*   npm (usually comes with Node.js)

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd bob-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    *   Create a `.env` file in the project root directory.
    *   Copy the contents of `.env.example` (if provided) or add the following required variables:

    ```dotenv
    # .env
    GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
    GEMINI_MODEL=gemini-1.5-flash # Or another compatible Gemini model name
    BAXUS_API_URL=https://services.baxus.co/api # Or the correct Baxus API endpoint
    PORT=3000 # Optional: Default port is 3000
    ```
    *   Replace `YOUR_GOOGLE_API_KEY` with your actual API key from Google AI Studio or Google Cloud.

4.  **Provide Bottle Data:**
    *   Ensure you have a `bottles.json` file in the project root. This file should contain an array of whisky objects, each with at least an `id` and `name`, and ideally other details used by the services (e.g., `avg_msrp`, `fair_price`, `shelf_price`, `spirit`, `proof`, `image_url`). The `dataLoader.js` script expects this file.

## Running the Application

1.  **Start the server:**
    ```bash
    npm start
    ```
2.  The server will start, typically on `http://localhost:3000` (or the port specified in your `.env` file). You should see the message: `Bob Backend server listening at http://localhost:3000`.

## API Endpoints

All recommendation endpoints are under the `/api` prefix.

*   **`GET /api/user/:username`**
    *   Description: Get general whisky recommendations for a user.
    *   Parameters:
        *   `:username` (path): The Baxus username.
    *   Response:
        ```json
        {
          "recommendations": [
            {
              "id": 123,
              "name": "Example Whisky A",
              "image_url": "...",
              "proof": 93.0,
              "rationale": "Based on your collection...",
              "avg_msrp": 55.99
            }
          ]
        }
        ```

*   **`GET /api/user/:username/similar-price`**
    *   Description: Get recommendations within a specific price range. If `min_price` or `max_price` are omitted or invalid, a default range is calculated based on the user's bar average price.
    *   Parameters:
        *   `:username` (path): The Baxus username.
        *   `min_price` (query, optional): Minimum fair price.
        *   `max_price` (query, optional): Maximum fair price.
    *   Response:
        ```json
        {
          "recommendations": [
            {
              "id": 456,
              "name": "Example Whisky B",
              "image_url": "...",
              "proof": 94.0,
              "rationale": "Fits your price range and...",
              "fair_price": 65.00
            }
          ]
        }
        ```

*   **`GET /api/user/:username/similar-profile`**
    *   Description: Get recommendations based on the user's taste profile similarity.
    *   Parameters:
        *   `:username` (path): The Baxus username.
        *   `focus` (query, optional): A specific profile aspect to focus on (e.g., 'peaty', 'sherry', 'beginner').
    *   Response:
        ```json
        {
          "recommendations": [
            {
              "id": 789,
              "name": "Example Whisky C",
              "image_url": "...",
              "proof": 90.0,
              "rationale": "Similar profile to whiskies you enjoy...",
              "avg_msrp": 42.50
            }
          ]
        }
        ```

*   **`GET /api/user/:username/complementary`**
    *   Description: Get recommendations aimed at diversifying the user's collection.
    *   Parameters:
        *   `:username` (path): The Baxus username.
    *   Response:
        ```json
        {
          "recommendations": [
            {
              "id": 101,
              "name": "Example Whisky D",
              "image_url": "...",
              "proof": 100.0,
              "rationale": "Adds diversity with a different region...",
              "avg_msrp": 85.00
            }
          ]
        }
        ```

*   **`GET /`**
    *   Description: Root health check endpoint.
    *   Response: `Bob Backend is running!` (text/plain)

## Core Logic Overview

1.  **Request:** An API request is received for a specific user and recommendation type.
2.  **Caching Check (Routes):** The application first checks if valid recommendations exist in the cache for this specific request (TTL: 2 minutes). If yes, cached data is returned.
3.  **Fetch User Data:** If no cache hit, the `baxusClient` fetches the user's bar data from the Baxus API.
4.  **Load Bottle Data:** The `dataLoader` ensures the master `bottlesMap` (from `bottles.json`) is available.
5.  **Filter Candidates:** Based on the recommendation type, relevant utility functions (`candidateUtils`, `priceUtils`) filter the `bottlesMap` to create a list of potential candidates (bottles the user doesn't own, possibly filtered by price or other criteria).
6.  **Generate Prompt:** The relevant recommendation service (`generalService`, `priceService`, etc.) constructs a detailed prompt for the LLM, including summaries of the user's collection and the candidate bottles, along with specific instructions based on the recommendation type.
7.  **LLM Call:** The `llmHelper` sends the prompt to the Google Generative AI model via `llmClient`.
8.  **Parse & Validate:** The `llmHelper` parses the JSON response from the LLM. `candidateUtils.filterHallucinations` validates that the recommended bottle IDs were actually part of the candidate list sent to the LLM.
9.  **Format Response:** `candidateUtils.mapRecommendationsToDetails` retrieves full details for the validated recommendations from `bottlesMap` and formats the final response array, including the LLM's reasoning.
10. **Caching (Routes):** The successfully generated recommendations are stored in the cache before being sent back to the client.
11. **Response:** The final JSON response is sent to the client.

## Configuration

Configuration is managed via environment variables loaded by `dotenv` and accessed through `config/index.js`. Key variables include API keys, external API URLs, the LLM model name, and the server port.

## Data

The application requires a `bottles.json` file in the project root. This file serves as the master database for whisky information used in generating candidates and enriching the final recommendations. Ensure this file is present and contains accurate data.

## Caching

Caching is implemented using `node-cache` in the recommendation routes:

*   **Recommendation Cache (`recommendationRoutes.js`):** Caches the final recommendation results for each specific API request (including username and query parameters) for 2 minutes (120 seconds) to provide faster responses for repeated requests and reduce load on the backend services and LLM.

The demo frontend to interact with this can be found [here](https://github.com/JYunth/bob-whisky-whisperer-ai)

![Demo video](https://youtu.be/d3bPnNRD-g4)
