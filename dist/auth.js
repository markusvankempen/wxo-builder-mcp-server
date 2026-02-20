import { config } from './config.js';
import fetch from 'node-fetch';
let cachedToken = null;
let tokenExpiry = 0;
/**
 * Get a valid IAM Bearer token.
 * Refreshes if expired or missing.
 */
export async function getIamToken() {
    const now = Math.floor(Date.now() / 1000);
    // Reuse valid token (buffer of 60s)
    if (cachedToken && tokenExpiry > now + 60) {
        return cachedToken;
    }
    console.error('Requesting new IAM token from IBM Cloud...'); // stderr for MCP logs
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
    params.append('apikey', config.apiKey);
    try {
        const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: params,
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`IAM Token Request Failed: ${response.status} ${text}`);
        }
        const data = (await response.json());
        cachedToken = data.access_token;
        tokenExpiry = now + data.expires_in;
        console.error(`Token acquired (expires in ${data.expires_in}s)`);
        if (!cachedToken) {
            throw new Error('Failed to retrieve access token from IAM response');
        }
        return cachedToken;
    }
    catch (error) {
        console.error(`Authentication Error: ${error.message}`);
        throw error;
    }
}
/**
 * Authenticated fetch wrapper for Watson Orchestrate API.
 */
export async function woFetch(endpoint, options = {}) {
    const token = await getIamToken();
    // Normalize endpoint (handle full URL vs relative path)
    let url = endpoint;
    if (!endpoint.startsWith('http')) {
        // Ensure leading slash for path construction
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        url = `${config.instanceUrl}${path}`;
    }
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
    };
    console.error(`  MCP Fetch: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
        ...options,
        headers,
    });
    return response;
}
