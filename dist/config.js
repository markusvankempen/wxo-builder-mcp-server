import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root (assuming running from dist/ or src/)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
// Also try cwd for good measure
dotenv.config({ path: path.join(process.cwd(), '.env') });
export const config = {
    apiKey: process.env.WO_API_KEY || '',
    instanceUrl: process.env.WO_INSTANCE_URL || '',
    iamTokenUrl: process.env.IAM_TOKEN_URL || 'https://iam.cloud.ibm.com/identity/token',
};
export function validateConfig() {
    const missing = [];
    if (!config.apiKey)
        missing.push('WO_API_KEY');
    if (!config.instanceUrl)
        missing.push('WO_INSTANCE_URL');
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:', missing.join(', '));
        return false;
    }
    return true;
}
