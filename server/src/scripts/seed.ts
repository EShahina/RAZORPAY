import { loadConfig } from '../config.js';
import { initDb } from '../db/index.js';
import { seedDatabase } from '../services/dataService.js';
import { closeDb } from '../db/index.js';
import { logger } from '../lib/logger.js';

const config = loadConfig();
initDb(config.databasePath);
const count = seedDatabase(config.modelPath);
logger.info({ count }, 'seed complete');
closeDb();
