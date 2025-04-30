import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
// Go up two levels from src/utils to the project root to find bottles.json
const __projectRoot = path.dirname(path.dirname(path.dirname(__filename)));

let bottlesData = [];
let bottlesMap = new Map();

try {
  const bottlesPath = path.join(__projectRoot, 'bottles.json'); // Path relative to project root
  console.log(`Attempting to load bottles data from: ${bottlesPath}`);
  const bottlesContent = fs.readFileSync(bottlesPath, 'utf8');
  bottlesData = JSON.parse(bottlesContent);

  // Create a Map for efficient lookup by ID
  bottlesData.forEach(bottle => {
    if (bottle.id != null) { // Ensure bottle has an ID
      bottlesMap.set(bottle.id, bottle);
    }
  });
  console.log(`Successfully loaded and mapped ${bottlesMap.size} bottles from bottles.json`);

} catch (err) {
  console.error("Error reading or parsing bottles.json in dataLoader:", err);
  // Depending on requirements, might re-throw or handle differently
  // For now, the server will start but recommendations might fail if map is empty
}

// Export the loaded data and map
export { bottlesData, bottlesMap };