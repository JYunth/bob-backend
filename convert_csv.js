import fs from 'fs';
import path from 'path';

const csvFilePath = path.resolve('processing.csv');
const jsonFilePath = path.resolve('processing.json');

try {
  // Read the CSV file
  const csvData = fs.readFileSync(csvFilePath, 'utf8');

  // Split into lines and remove potential empty lines
  const lines = csvData.trim().split('\n');

  // Get headers (first line)
  const headers = lines[0].split(',');

  const jsonData = [];

  // Process data rows (starting from the second line)
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const entry = {};

    // Check if the number of values matches the number of headers
    if (values.length === headers.length) {
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j].trim();
        let value = values[j].trim();

        // Attempt to convert numeric fields
        // Check if value is not empty and is a valid number representation
        if (value !== '' && !isNaN(value) && value !== null) {
           // Check specifically for columns that should be numbers
           if (['id', 'abv', 'fair_price', 'total_score', 'wishlist_count', 'bar_count', 'ranking'].includes(header)) {
             value = Number(value);
           }
        } else if (value === '') {
            // Handle empty strings, maybe represent as null or keep as empty string
            value = null; // Or keep as '' depending on preference
        }

        entry[header] = value;
      }
      jsonData.push(entry);
    } else {
      console.warn(`Skipping line ${i + 1}: Number of values (${values.length}) does not match number of headers (${headers.length}). Line content: ${lines[i]}`);
    }
  }

  // Write the JSON data to the output file
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');

  console.log(`Successfully converted ${csvFilePath} to ${jsonFilePath}`);

} catch (error) {
  console.error('Error converting CSV to JSON:', error);
}