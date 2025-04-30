import app from './src/server.js';
import config from './config/index.js';

app.listen(config.port, () => {
  console.log(`Bob Backend server listening at http://localhost:${config.port}`);
});