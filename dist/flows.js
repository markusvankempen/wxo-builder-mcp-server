import { woFetch } from './auth.js';
/**
 * List all available flows.
 */
export async function listFlows(limit = 20, offset = 0) {
    console.error(`Listing flows...`);
    try {
        const response = await woFetch(`/v1/flows/?limit=${limit}&offset=${offset}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to list flows: ${response.status} ${response.statusText} - ${text}`);
        }
        return await response.json();
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Get a specific flow by ID.
 */
export async function getFlow(flowId) {
    console.error(`Getting flow ${flowId}...`);
    try {
        const response = await woFetch(`/v1/flows/${flowId}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to get flow: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Delete a flow by ID.
 */
export async function deleteFlow(flowId) {
    console.error(`Deleting flow ${flowId}...`);
    try {
        const response = await woFetch(`/v1/flows/${flowId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error(`Failed to delete flow: ${response.status} ${response.statusText}`);
        }
        return { success: true, message: `Flow ${flowId} deleted successfully.` };
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Create or Update a Flow.
 * The API seems to just take the Flow JSON.
 */
export async function createFlow(flowJson) {
    console.error(`Creating flow...`);
    try {
        const response = await woFetch('/v1/flows/', {
            method: 'POST',
            body: JSON.stringify(flowJson),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to create flow: ${response.status} ${response.statusText} - ${text}`);
        }
        return await response.json();
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
