import { loadConfig } from '../config.js';
import { initStore, closeStore } from '../db/store.js';
import { seedDatabase } from '../services/dataService.js';
import { logger } from '../lib/logger.js';

const config = loadConfig();
await initStore(config);
const count = await seedDatabase(config.modelPath);
logger.info({ count }, 'seed complete');
await closeStore();