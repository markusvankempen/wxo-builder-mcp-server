/**
 * WxO MCP Server - Connections & Connectors API
 * Mirrors vscode-extension/api/connections.ts
 *
 * @author Markus van Kempen
 * @license Apache-2.0
 */
import { woFetch } from './auth.js';
/** List available connectors from the catalog. */
export async function listConnectors(limit = 50) {
    const response = await woFetch(`/v1/orchestrate/catalog/applications?limit=${limit}`, {
        method: 'GET',
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to list connectors: ${response.status} ${text}`);
    }
    return await response.json();
}
/** List connections (configured + unconfigured) for a scope. */
export async function listConnections(scope) {
    const scopeParam = scope || 'draft';
    const response = await woFetch(`/v1/orchestrate/connections/applications?include_details=true&scope=${scopeParam}`, { method: 'GET' });
    if (!response.ok) {
        const text = await response.text();
        console.error(`Connections API: ${response.status} - ${text}`);
        return { applications: [] };
    }
    return await response.json();
}
/**
 * List only active and live connections (not tools). Returns deduplicated connection names.
 * Use for "list all connections which are active and live, just the connections not the tools".
 */
export async function listActiveLiveConnections() {
    const res = await listConnections('live');
    const apps = res?.applications || [];
    const active = apps.filter((a) => a.credentials_entered === true);
    const seen = new Set();
    const connections = [];
    for (const a of active) {
        const appId = a.app_id || a.connection_id || '';
        if (!appId || seen.has(appId))
            continue;
        seen.add(appId);
        connections.push({
            app_id: appId,
            display_name: a.display_name || a.name || appId,
        });
    }
    return {
        connections,
        names: connections.map((c) => c.display_name || c.app_id),
    };
}
/** List connections from both draft and live scopes. */
export async function listConnectionsAll() {
    const draftRes = await listConnections('draft');
    const draftApps = draftRes?.applications || [];
    let liveApps = [];
    try {
        const liveRes = await listConnections('live');
        liveApps = liveRes?.applications || [];
    }
    catch {
        // Developer Edition may not have live scope
    }
    const merged = [...draftApps];
    const seen = new Set(draftApps.map((a) => `${a.app_id || a.connection_id}:${a.environment || 'draft'}`));
    for (const a of liveApps) {
        const key = `${a.app_id || a.connection_id}:${a.environment || 'live'}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(a);
        }
    }
    return { applications: merged };
}
/** Get a connection by app_id. */
export async function getConnection(appId) {
    const response = await woFetch(`/v1/orchestrate/connections/applications?app_id=${encodeURIComponent(appId)}`, {
        method: 'GET',
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get connection: ${response.status} ${text}`);
    }
    return await response.json();
}
/** Create a new connection entry. */
export async function createConnection(payload) {
    const response = await woFetch('/v1/orchestrate/connections/applications', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create connection: ${response.status} ${text}`);
    }
    return await response.json();
}
/** Delete a connection by app_id. */
export async function deleteConnection(appId) {
    const response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete connection: ${response.status} ${text}`);
    }
    return { success: true };
}
/** Create connection configuration. */
export async function createConnectionConfiguration(appId, env, kind, type = 'team', serverUrl) {
    const securityScheme = kind === 'api_key'
        ? 'api_key_auth'
        : kind === 'basic'
            ? 'basic_auth'
            : kind === 'bearer'
                ? 'bearer_auth'
                : 'api_key_auth';
    const body = {
        environment: env,
        kind,
        type,
        preference: type,
        security_scheme: securityScheme,
    };
    if (serverUrl)
        body.server_url = serverUrl;
    const response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configurations`, { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to create configuration: ${response.status} ${text}`);
    }
    return await response.json().catch(() => ({ success: true }));
}
/** Set API key credentials. */
export async function setApiKeyCredentials(appId, apiKey, env = 'draft') {
    let response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
        method: 'PATCH',
        body: JSON.stringify({ runtime_credentials: { api_key: apiKey } }),
    });
    if (!response.ok) {
        response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
            method: 'POST',
            body: JSON.stringify({ runtime_credentials: { api_key: apiKey } }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to set API key credentials: ${response.status} ${text}`);
        }
    }
    return await response.json().catch(() => ({ success: true }));
}
/** Set basic-auth credentials. */
export async function setBasicCredentials(appId, username, password, env = 'draft') {
    let response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
        method: 'PATCH',
        body: JSON.stringify({ runtime_credentials: { username, password } }),
    });
    if (!response.ok) {
        response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
            method: 'POST',
            body: JSON.stringify({ runtime_credentials: { username, password } }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to set basic credentials: ${response.status} ${text}`);
        }
    }
    return await response.json().catch(() => ({ success: true }));
}
/** Set bearer token credentials. */
export async function setBearerCredentials(appId, token, env = 'draft') {
    let response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
        method: 'PATCH',
        body: JSON.stringify({ runtime_credentials: { token } }),
    });
    if (!response.ok) {
        response = await woFetch(`/v1/orchestrate/connections/applications/${encodeURIComponent(appId)}/configs/${env}/runtime_credentials`, {
            method: 'POST',
            body: JSON.stringify({ runtime_credentials: { token } }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to set bearer credentials: ${response.status} ${text}`);
        }
    }
    return await response.json().catch(() => ({ success: true }));
}
