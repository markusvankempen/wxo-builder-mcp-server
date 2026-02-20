/**
 * WxO MCP Server - Models
 * Default model for agents (mirrors extension models.ts).
 */
import { woFetch } from './auth.js';
const PREFERRED_DEFAULT_MODEL_ID = 'groq/openai/gpt-oss-120b';
export async function listModels() {
    try {
        const res = await woFetch('/v1/models/list', { method: 'GET' });
        if (!res.ok)
            return [];
        const data = await res.json().catch(() => ({}));
        const list = data.resources ?? data.data ?? (Array.isArray(data) ? data : []);
        return Array.isArray(list) ? list : [];
    }
    catch {
        return [];
    }
}
export async function getDefaultModelId() {
    try {
        const models = await listModels();
        if (!models.length)
            return PREFERRED_DEFAULT_MODEL_ID;
        const preferred = models.find((m) => m.id === PREFERRED_DEFAULT_MODEL_ID);
        if (preferred)
            return PREFERRED_DEFAULT_MODEL_ID;
        return models[0]?.id ?? PREFERRED_DEFAULT_MODEL_ID;
    }
    catch {
        return PREFERRED_DEFAULT_MODEL_ID;
    }
}
