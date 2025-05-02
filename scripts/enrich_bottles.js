import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

// --- Configuration ---
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const LLM_MODEL_NAME = 'gemini-2.0-flash'; // Using the specified flash model
const INPUT_FILE = '../bottles.json';
const OUTPUT_FILE = '../bottles_enriched.json';

// Define the target schema fields
const TARGET_FIELDS = [
    'name', 'brand', 'spirit_type', 'proof', 'age',
    'description', 'abv', 'msrp', 'spirit_profile'
];

const SPIRIT_PROFILE_FIELDS = [
    'Sweet', 'Floral', 'Woody', 'Spicy', 'Smoky', 'Fruity', 'Smooth'
];

// --- Helper Functions ---

/**
 * Get the absolute path relative to the current script file.
 * @param {string} relativePath - Path relative to the script.
 * @returns {string} Absolute path.
 */
const getAbsolutePath = (relativePath) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, relativePath);
};

/**
 * Checks if a value is considered missing (null, undefined, or empty string).
 * For objects (like spirit_profile), checks if it's null or undefined.
 * @param {*} value - The value to check.
 * @returns {boolean} True if the value is missing.
 */
const isMissing = (value) => {
    if (typeof value === 'object' && value !== null) {
        return false; // Consider non-null objects as present
    }
    return value === null || value === undefined || value === '';
};

/**
 * Constructs the prompt for the LLM.
 * @param {object} bottle - The bottle data.
 * @param {string[]} missingFields - List of fields needing generation.
 * @returns {string} The generated prompt.
 */
const constructPrompt = (bottle, missingFields) => {
    const existingData = TARGET_FIELDS.map(field => {
        let value = bottle[field];
        if (field === 'spirit_profile' && value && typeof value === 'object') {
            value = JSON.stringify(value);
        } else if (isMissing(value)) {
            value = 'N/A';
        }
        return `${field}: ${value}`;
    }).join('\n');

    return `Given the following information about a spirit bottle:
${existingData}

Please generate the missing information ONLY for the fields listed below. Provide the output as a valid JSON object containing ONLY the generated fields and their values. Do not include fields that were already provided.

- Ensure 'spirit_type' is one of the common types (e.g., Bourbon, Rye, Scotch, Irish Whiskey, Japanese Whisky, Rum, Tequila, Mezcal, Gin, Vodka).
- Ensure 'proof' is a number.
- Ensure 'age' is a string or number (e.g., "12 Years", 12, "NAS").
- Ensure 'description' is a concise string.
- Ensure 'abv' is a number representing percentage (e.g., 40.0).
- Ensure 'msrp' is a number (e.g., 49.99).
- Ensure 'spirit_profile' is a JSON object with keys: ${SPIRIT_PROFILE_FIELDS.join(', ')}. Each key should have a numeric rating from 1 to 5 (e.g., {"Sweet": 4, "Smoky": 1.5}).

Missing fields to generate: ${missingFields.join(', ')}

Respond ONLY with the JSON object containing the generated data for these missing fields. Example response for missing 'description' and 'msrp': {"description": "A smooth bourbon...", "msrp": 55.99}
Example response for missing 'spirit_profile': {"spirit_profile": {"Sweet": 3, "Floral": 1, "Woody": 4, "Spicy": 2, "Smoky": 0, "Fruity": 3, "Smooth": 4}}
`;
};


// --- Main Enrichment Logic ---

/**
 * Enriches a single bottle object using the LLM.
 * @param {object} bottle - The bottle object to enrich.
 * @param {object} model - The initialized Gemini model instance.
 * @returns {Promise<object>} The enriched bottle object.
 */
const enrichBottle = async (bottle, model) => {
    const missingFields = TARGET_FIELDS.filter(field => {
        if (field === 'spirit_profile') {
            // Check if spirit_profile exists and has all required sub-fields
            const profile = bottle[field];
            if (isMissing(profile) || typeof profile !== 'object') return true;
            return !SPIRIT_PROFILE_FIELDS.every(subField => !isMissing(profile[subField]) && typeof profile[subField] === 'number');
        }
        return isMissing(bottle[field]);
    });

    if (missingFields.length === 0) {
        console.log(`Bottle "${bottle.name || 'Unknown'}" already complete. Skipping.`);
        return bottle; // No enrichment needed
    }

    console.log(`Enriching bottle "${bottle.name || 'Unknown'}". Missing: ${missingFields.join(', ')}`);
    const prompt = constructPrompt(bottle, missingFields);

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Attempt to parse the LLM response as JSON
        let generatedData;
        try {
            // Clean potential markdown ```json ... ```
            const cleanedText = text.replace(/^```json\s*|```$/g, '').trim();
            generatedData = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error(`Error parsing LLM JSON response for bottle "${bottle.name || 'Unknown'}": ${parseError.message}. Response text: "${text}"`);
            // Attempt to salvage if possible, or return original bottle
            return bottle; // Failed to parse, return original to avoid corruption
        }

        // Merge generated data into the bottle object
        const enrichedBottle = { ...bottle };
        for (const field in generatedData) {
            if (TARGET_FIELDS.includes(field)) {
                 // Basic type validation/coercion based on schema expectation
                 if (field === 'proof' || field === 'abv' || field === 'msrp') {
                    enrichedBottle[field] = Number(generatedData[field]) || bottle[field]; // Keep original if conversion fails
                 } else if (field === 'spirit_profile' && typeof generatedData[field] === 'object') {
                    // Ensure spirit_profile subfields are numbers
                    const profile = generatedData[field];
                    const validatedProfile = enrichedBottle[field] && typeof enrichedBottle[field] === 'object' ? { ...enrichedBottle[field] } : {};
                    SPIRIT_PROFILE_FIELDS.forEach(subField => {
                        if (!isMissing(profile[subField])) {
                            const numVal = Number(profile[subField]);
                            // Only update if it's a valid number between 1 and 5
                            if (!isNaN(numVal) && numVal >= 1 && numVal <= 5) {
                                validatedProfile[subField] = numVal;
                            } else {
                                console.warn(`Invalid spirit_profile value for ${subField} in "${bottle.name || 'Unknown'}": ${profile[subField]}. Keeping original/default.`);
                            }
                        }
                    });
                     enrichedBottle[field] = validatedProfile;
                 } else {
                    enrichedBottle[field] = generatedData[field];
                 }
            }
        }
        console.log(`Successfully enriched bottle "${bottle.name || 'Unknown'}".`);
        return enrichedBottle;

    } catch (error) {
        console.error(`Error calling LLM for bottle "${bottle.name || 'Unknown'}": ${error.message}`);
        // Decide how to handle: skip bottle, retry, etc. Here, we return the original.
        return bottle; // Return original bottle on API error
    }
};

/**
 * Main function to run the enrichment process.
 */
const main = async () => {
    console.log("Starting bottle enrichment script...");

    if (!GOOGLE_API_KEY) {
        console.error("Error: GOOGLE_API_KEY not found in environment variables. Make sure it's set in a .env file in the root directory.");
        process.exit(1);
    }

    // Initialize Gemini Client
    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({
        model: LLM_MODEL_NAME,
        // Basic safety settings - adjust as needed
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ],
        generationConfig: {
            // Ensure JSON output if model supports it directly, otherwise rely on prompt engineering
             responseMimeType: "application/json", // Request JSON output directly
        },
    });


    // Define file paths
    const inputFilePath = getAbsolutePath(INPUT_FILE);
    const outputFilePath = getAbsolutePath(OUTPUT_FILE);

    // Read input data
    let bottles;
    try {
        console.log(`Reading data from ${inputFilePath}...`);
        const rawData = await fs.readFile(inputFilePath, 'utf-8');
        bottles = JSON.parse(rawData);
        if (!Array.isArray(bottles)) {
            throw new Error("Input data is not a JSON array.");
        }
        console.log(`Read ${bottles.length} bottles.`);
    } catch (error) {
        console.error(`Error reading or parsing input file ${inputFilePath}: ${error.message}`);
        process.exit(1);
    }

    // Process bottles concurrently
    console.log("Enriching bottles...");
    const enrichmentPromises = bottles.map(bottle => enrichBottle(bottle, model));

    // Wait for all enrichment tasks to settle
    const results = await Promise.allSettled(enrichmentPromises);

    const enrichedBottles = results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.error(`Failed to process bottle index ${index} ("${bottles[index]?.name || 'Unknown'}"): ${result.reason}`);
            return bottles[index]; // Return original bottle if enrichment failed for it
        }
    });

    // Write output data
    try {
        console.log(`Writing enriched data to ${outputFilePath}...`);
        await fs.writeFile(outputFilePath, JSON.stringify(enrichedBottles, null, 2), 'utf-8');
        console.log("Enrichment complete. Output saved.");
    } catch (error) {
        console.error(`Error writing output file ${outputFilePath}: ${error.message}`);
        process.exit(1);
    }
};

// Execute main function
main().catch(error => {
    console.error("An unexpected error occurred:", error);
    process.exit(1);
});