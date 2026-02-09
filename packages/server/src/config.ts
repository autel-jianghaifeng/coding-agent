import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.resolve(projectRoot, '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  aiProvider: (process.env.AI_PROVIDER || 'mock') as 'mock' | 'claude',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  workspaceRoot: path.resolve(projectRoot, 'workspace'),
};
