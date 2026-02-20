/**
 * WxO MCP Server - Skills/Tools API
 * Mirrors vscode-extension/api/skills.ts (buildToolSpec, connection_id, skill_v2.json)
 *
 * @author Markus van Kempen
 * @license Apache-2.0
 */
import { woFetch } from './auth.js';
import archiver from 'archiver';
import fetch from 'node-fetch';
import { ensureTestAgentForTool } from './agents.js';
import { createConnection, createConnectionConfiguration, setApiKeyCredentials, getConnection } from './connections.js';
/** Convert WxO skill format to OAS (mirrors extension skillToOas for copy flow). */
export function skillToOas(skill) {
    const b = skill?.binding?.openapi;
    const method = (b?.http_method || 'GET').toLowerCase();
    const path = b?.http_path || '/';
    const servers = (b?.servers || []).map((s) => (typeof s === 'string' ? s : s?.url)).filter(Boolean);
    const security = b?.security;
    const connectionId = b?.connection_id;
    const inputSchema = skill?.input_schema;
    const outputSchema = skill?.output_schema;
    const params = [];
    if (inputSchema?.properties) {
        for (const [key, prop] of Object.entries(inputSchema.properties)) {
            const name = prop.aliasName ?? key;
            params.push({
                name,
                in: prop.in || 'query',
                required: (inputSchema.required || []).includes(key),
                description: prop.description || '',
                schema: {
                    type: prop.type || 'string',
                    title: prop.title,
                    default: prop.default,
                    ...(prop.enum ? { enum: prop.enum } : {}),
                },
            });
        }
    }
    const title = (skill?.display_name || skill?.name || 'Tool') + ' (Copy)';
    const baseId = (skill?.name || 'tool').replace(/[^a-zA-Z0-9_]/g, '_');
    const skillId = `${baseId}_copy_v1`;
    const oas = {
        openapi: '3.0.1',
        info: {
            title,
            version: skill?.info?.version || '1.0.0',
            description: skill?.description || '',
            'x-ibm-skill-name': title,
            'x-ibm-skill-id': skillId,
        },
        servers: servers.length ? servers.map((u) => ({ url: u })) : [{ url: 'https://httpbin.org' }],
        paths: {
            [path]: {
                [method]: {
                    operationId: skill?.name || 'operation',
                    summary: skill?.display_name || skill?.name || 'Operation',
                    parameters: params,
                    responses: {
                        '200': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: outputSchema || { type: 'object' },
                                },
                            },
                        },
                    },
                },
            },
        },
    };
    if (security?.length)
        oas['x-ibm-security'] = security;
    if (connectionId)
        oas['x-ibm-connection-id'] = connectionId;
    return oas;
}
/** Derive WxO binding security from OpenAPI spec. */
function deriveBindingSecurity(openApiSpec, op) {
    const explicit = openApiSpec['x-ibm-security'] ?? openApiSpec.binding?.openapi?.security;
    if (Array.isArray(explicit) && explicit.length > 0)
        return explicit;
    const schemes = openApiSpec.components?.securitySchemes ?? {};
    const secRefs = op?.security ?? openApiSpec.security ?? [];
    if (!Array.isArray(secRefs) || secRefs.length === 0)
        return [];
    const flat = [];
    for (const ref of secRefs) {
        if (typeof ref !== 'object' || !ref)
            continue;
        const name = Object.keys(ref)[0];
        const scheme = schemes[name];
        if (scheme?.type === 'apiKey') {
            flat.push({
                type: 'apiKey',
                in: scheme.in || 'query',
                name: scheme.name || 'apiKey',
            });
        }
        else if (scheme?.type === 'http' || scheme?.scheme === 'bearer') {
            flat.push({
                type: 'http',
                scheme: scheme.scheme || 'bearer',
                name: scheme.name || 'Authorization',
            });
        }
    }
    return flat;
}
/** Build full tool spec from toolSpec + OpenAPI (matches extension buildToolSpec). */
function buildToolSpec(toolSpec, openApiSpec) {
    const spec = {
        name: toolSpec.name,
        display_name: openApiSpec.info?.['x-ibm-skill-name'] || openApiSpec.info?.title || toolSpec.name,
        description: toolSpec.description,
        permission: toolSpec.permission || 'read_write',
        restrictions: toolSpec.restrictions || undefined,
        tags: toolSpec.tags || undefined,
    };
    if (openApiSpec.paths) {
        const pathKeys = Object.keys(openApiSpec.paths);
        if (pathKeys.length > 0) {
            const pathKey = pathKeys[0];
            const pathObj = openApiSpec.paths[pathKey];
            const methods = ['get', 'post', 'put', 'patch', 'delete'];
            for (const method of methods) {
                if (!pathObj[method])
                    continue;
                const op = pathObj[method];
                const servers = (openApiSpec.servers || []).map((s) => (typeof s === 'string' ? s : s.url));
                const connectionId = openApiSpec['x-ibm-connection-id'] ?? openApiSpec.binding?.openapi?.connection_id ?? null;
                const security = deriveBindingSecurity(openApiSpec, op);
                spec.binding = {
                    openapi: {
                        http_method: method.toUpperCase(),
                        http_path: pathKey,
                        security: security,
                        servers: servers,
                        connection_id: connectionId || null,
                    },
                };
                const properties = {};
                const required = [];
                const usedKeys = new Set();
                if (op.parameters && op.parameters.length > 0) {
                    op.parameters.forEach((p) => {
                        const paramIn = p.in || 'query';
                        const paramName = p.name;
                        let propKey = paramName;
                        if (usedKeys.has(propKey)) {
                            propKey = `${paramIn}_${paramName}`;
                        }
                        usedKeys.add(propKey);
                        const propSchema = {
                            type: p.schema?.type || 'string',
                            title: p.schema?.title ?? paramName,
                            description: p.description || p.schema?.description || '',
                            in: paramIn,
                        };
                        if (p.schema?.default !== undefined && p.schema?.default !== null) {
                            propSchema.default = p.schema.default;
                        }
                        if (propKey !== paramName) {
                            propSchema.aliasName = paramName;
                        }
                        properties[propKey] = propSchema;
                        if (p.required) {
                            required.push(propKey);
                        }
                    });
                }
                spec.input_schema = {
                    type: 'object',
                    properties,
                    required: required.length > 0 ? required : undefined,
                };
                if (op.responses?.['200']?.content?.['application/json']?.schema) {
                    const responseSchema = op.responses['200'].content['application/json'].schema;
                    spec.output_schema = {
                        ...responseSchema,
                        description: responseSchema.description || op.responses['200'].description || 'Success',
                    };
                }
                break;
            }
        }
    }
    return spec;
}
function createOpenApiZip(openApiSpec) {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const chunks = [];
        archive.on('data', (chunk) => chunks.push(chunk));
        archive.on('error', (err) => reject(err));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.append(JSON.stringify(openApiSpec, null, 2), { name: 'skill_v2.json' });
        archive.append('2.0.0\n', { name: 'bundle-format' });
        archive.finalize();
    });
}
/** Sanitize tool name for Watson Orchestrate: letters, digits, underscores only; cannot start with digit. */
function sanitizeToolName(name) {
    let s = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
    if (/^[0-9]/.test(s))
        s = 't_' + s;
    return s || 'tool_copy';
}
/** Returns true if a tool has a connection/security binding (matches extension skillsView). */
function hasConnection(skill) {
    const security = skill?.binding?.openapi?.security ??
        skill?.binding?.security ??
        skill?.security;
    const connectionId = skill?.binding?.openapi?.connection_id ??
        skill?.binding?.connection_id ??
        skill?.connection_id;
    return (Array.isArray(security) && security.length > 0) || !!connectionId;
}
/** Extract skills array from API response (matches extension skillsView normalization). */
function extractSkills(data) {
    if (Array.isArray(data))
        return data;
    if (data?.items && Array.isArray(data.items))
        return data.items;
    if (data?.tools && Array.isArray(data.tools))
        return data.tools;
    if (data?.data && Array.isArray(data.data))
        return data.data;
    return [];
}
/**
 * List tools grouped like the extension Tools view: Tools with Connections + Standard Tools.
 * Use this for prompts like "List my Watson Orchestrate tools with active connections".
 */
export async function listToolsWithConnections(limit = 100) {
    const raw = await listSkills(limit, 0);
    const skills = extractSkills(raw);
    const withConnection = skills.filter((s) => hasConnection(s));
    const standard = skills.filter((s) => !hasConnection(s));
    return {
        summary: {
            total: skills.length,
            tools_with_connections: withConnection.length,
            standard_tools: standard.length,
        },
        tools_with_connections: withConnection.map((s) => ({
            id: s.id || s.name,
            display_name: s.display_name || s.name || s.id || 'Unnamed',
            description: s.description || '',
            connection_id: s?.binding?.openapi?.connection_id || null,
            auth_type: s?.binding?.openapi?.security?.[0]?.type || 'apiKey',
        })),
        standard_tools: standard.map((s) => ({
            id: s.id || s.name,
            display_name: s.display_name || s.name || s.id || 'Unnamed',
            description: s.description || '',
        })),
    };
}
/**
 * List only standard tools (tools with no connections). Returns accurate count and list from Watson Orchestrate.
 * Use for "list standard tools" or "tools with no connections" – tools with empty/missing security and connection_id.
 */
export async function listStandardTools(limit = 100) {
    const raw = await listToolsWithConnections(limit);
    const standard = raw.standard_tools || [];
    return {
        count: standard.length,
        standard_tools: standard.map((s) => ({
            id: s.id || s.name || 'unknown',
            display_name: s.display_name || s.name || s.id || 'Unnamed',
            description: s.description || '',
        })),
    };
}
/**
 * Resolve tool name (e.g. "News Search Tool") to tool ID by listing tools and matching display_name/name.
 */
export async function resolveToolByName(toolName) {
    const raw = await listSkills(100, 0);
    const skills = extractSkills(raw);
    const nameLower = toolName.toLowerCase().trim();
    const match = skills.find((s) => (s.display_name || '').toLowerCase() === nameLower ||
        (s.name || '').toLowerCase() === nameLower ||
        (s.display_name || '').toLowerCase().includes(nameLower) ||
        (s.name || '').toLowerCase().includes(nameLower));
    return match ? match.id || match.name : null;
}
/**
 * Invoke a tool via Watson Orchestrate agentic runs API.
 * Uses an agent that has the tool in its toolkit (creates WxoBuilderTestAgent if needed).
 */
async function invokeToolRemote(toolId, parameters = {}, agentId) {
    const directive = Object.keys(parameters).length > 0
        ? `Execute the tool with these parameters. Return the raw result data.\n\nParameters: ${JSON.stringify(parameters)}`
        : 'Execute the tool with default parameters. Return the raw result data.';
    const payload = {
        tool_id: toolId,
        parameters,
        message: { role: 'user', content: directive },
    };
    if (agentId)
        payload.agent_id = agentId;
    const runRes = await woFetch('/v1/orchestrate/runs', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    if (!runRes.ok) {
        const errText = await runRes.text();
        throw new Error(`Run failed (${runRes.status}): ${errText}`);
    }
    const runData = (await runRes.json());
    const threadId = runData.thread_id;
    if (!threadId) {
        throw new Error('No thread_id returned from run. Response: ' + JSON.stringify(runData));
    }
    const maxAttempts = 12;
    let messages = [];
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const msgRes = await woFetch(`/v1/orchestrate/threads/${threadId}/messages`);
        if (msgRes.ok) {
            const msgData = (await msgRes.json());
            messages = Array.isArray(msgData) ? msgData : msgData.messages || msgData.data || [];
            const assistantMsg = messages.find((m) => m.role === 'assistant');
            if (assistantMsg)
                break;
        }
    }
    const assistantMsg = messages.find((m) => m.role === 'assistant') || messages[0];
    let responseData = null;
    if (assistantMsg && assistantMsg.content) {
        const content = assistantMsg.content;
        if (Array.isArray(content)) {
            const toolResult = content.find((c) => c.type === 'tool_result');
            const textBlock = content.find((c) => c.type === 'text');
            if (toolResult != null) {
                responseData = toolResult.content ?? toolResult.output ?? toolResult.result ?? toolResult;
            }
            else if (textBlock && textBlock.text != null) {
                responseData =
                    typeof textBlock.text === 'string'
                        ? textBlock.text
                        : (textBlock.text?.value ?? JSON.stringify(textBlock.text));
            }
            else {
                responseData = content;
            }
        }
        else {
            responseData = content;
        }
    }
    if (responseData == null) {
        responseData = messages.length > 0 ? messages : { thread_id: threadId, info: 'No tool output in messages.' };
    }
    return { data: responseData, threadId };
}
/**
 * Execute a Watson Orchestrate tool by name or ID.
 * Resolves "News Search Tool" etc. to tool ID, ensures an agent has the tool, then invokes it.
 */
export async function executeTool(args) {
    const { tool_name, tool_id, parameters = {}, agent_id } = args;
    let resolvedId = null;
    if (tool_id) {
        resolvedId = tool_id;
    }
    else if (tool_name) {
        resolvedId = await resolveToolByName(tool_name);
        if (!resolvedId) {
            throw new Error(`Tool not found: "${tool_name}". Use list_tools_with_connections or list_skills to see available tools.`);
        }
    }
    else {
        throw new Error('Provide tool_name (e.g. "News Search Tool") or tool_id');
    }
    let agentId = agent_id;
    if (!agentId) {
        agentId = await ensureTestAgentForTool(resolvedId);
    }
    const { data, threadId } = await invokeToolRemote(resolvedId, parameters, agentId);
    return {
        success: true,
        tool_id: resolvedId,
        thread_id: threadId,
        result: data,
    };
}
/**
 * List all available tools/skills.
 */
export async function listSkills(limit = 100, offset = 0) {
    console.error(`Listing skills (limit: ${limit}, offset: ${offset})...`);
    try {
        const response = await woFetch(`/v1/orchestrate/tools?limit=${limit}&offset=${offset}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to list tools: ${response.status} ${response.statusText} - ${text}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Get a specific skill by ID.
 */
export async function getSkill(skillId) {
    console.error(`Getting skill ${skillId}...`);
    try {
        const response = await woFetch(`/v1/orchestrate/tools/${skillId}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to get skill: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Delete a skill by ID.
 */
export async function deleteSkill(skillId) {
    console.error(`Deleting skill ${skillId}...`);
    try {
        const response = await woFetch(`/v1/orchestrate/tools/${skillId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error(`Failed to delete skill: ${response.status} ${response.statusText}`);
        }
        return { success: true, message: `Skill ${skillId} deleted successfully.` };
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Deploy an OpenAPI skill. Uses buildToolSpec (same as extension) so:
 * - connection_id from openapi_spec['x-ibm-connection-id'] is assigned to the tool
 * - OpenAPI parameters, servers, security are properly mapped
 */
export async function deploySkill(args) {
    const { toolSpec, openApiSpec } = args;
    if (!toolSpec || !openApiSpec) {
        throw new Error('Missing required arguments: toolSpec, openApiSpec');
    }
    const enrichedSpec = buildToolSpec(toolSpec, openApiSpec);
    console.error(`Creating Tool "${toolSpec.name}" (connection_id: ${enrichedSpec.binding?.openapi?.connection_id ?? 'none'})...`);
    const createRes = await woFetch('/v1/orchestrate/tools', {
        method: 'POST',
        body: JSON.stringify(enrichedSpec),
    });
    if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`Failed to create tool: ${createRes.status} ${text}`);
    }
    const text = await createRes.text();
    let toolData;
    try {
        toolData = JSON.parse(text);
    }
    catch {
        throw new Error(`Failed to parse tool response: ${text}`);
    }
    const toolId = toolData.id;
    try {
        const zipBuffer = await createOpenApiZip(openApiSpec);
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const filename = `${toolId}.zip`;
        const head = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/zip\r\n\r\n`;
        const tail = `\r\n--${boundary}--\r\n`;
        const body = Buffer.concat([Buffer.from(head), zipBuffer, Buffer.from(tail)]);
        const uploadRes = await woFetch(`/v1/orchestrate/tools/${toolId}/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
        });
        if (!uploadRes.ok) {
            console.error('Artifact upload failed (tool still created):', uploadRes.status);
        }
    }
    catch (uploadErr) {
        console.error('Artifact upload error (tool still created):', uploadErr.message);
    }
    return { success: true, toolId };
}
/**
 * Copy a tool: fetch it, convert to OpenAPI, deploy as a new tool.
 * Optionally pass new_name (e.g. "MVKWeatherV2") to override the default copy name.
 * Keeps connection and other parameters the same. Tool names must use only letters, digits, underscores.
 */
export async function copySkill(skillId, newName) {
    const skill = await getSkill(skillId);
    const openApiSpec = skillToOas(skill);
    const defaultName = openApiSpec.info?.['x-ibm-skill-id'] || `${(skill?.name || 'tool').replace(/[^a-zA-Z0-9_]/g, '_')}_copy_v1`;
    const toolName = newName ? sanitizeToolName(newName) : defaultName;
    openApiSpec.info = openApiSpec.info || {};
    openApiSpec.info['x-ibm-skill-id'] = toolName;
    openApiSpec.info['x-ibm-skill-name'] = newName
        ? newName
        : openApiSpec.info['x-ibm-skill-name'] || `${skill?.display_name || skill?.name || 'Copy'} (Copy)`;
    const toolSpec = {
        name: toolName,
        description: openApiSpec.info?.description || skill?.description || 'Copy of existing tool',
    };
    const result = await deploySkill({ toolSpec, openApiSpec });
    return { ...result, sourceSkillId: skillId, tool_name: toolName };
}
/**
 * Update a tool (name, display_name, description, permission, tags).
 * Note: binding, input_schema, output_schema, connection_id are NOT editable after creation.
 */
export async function updateSkill(skillId, skillJson) {
    const updatePayload = {};
    if (skillJson.name) {
        updatePayload.name = skillJson.name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, '');
    }
    if (skillJson.display_name)
        updatePayload.display_name = skillJson.display_name;
    if (skillJson.description)
        updatePayload.description = skillJson.description;
    updatePayload.permission = skillJson.permission || 'read_write';
    if (skillJson.restrictions)
        updatePayload.restrictions = skillJson.restrictions;
    if (skillJson.tags)
        updatePayload.tags = skillJson.tags;
    const response = await woFetch(`/v1/orchestrate/tools/${skillId}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update skill: ${response.status} ${text}`);
    }
    if (response.status === 204)
        return { success: true };
    const text = await response.text();
    if (!text)
        return { success: true };
    try {
        return JSON.parse(text);
    }
    catch {
        return { success: true };
    }
}
/**
 * Deploy a tool from a URL. Handles both: (1) URLs with API key -> creates connection + tool,
 * (2) Public URLs without auth (REST Countries, Open-Meteo, etc.) -> creates standard tool.
 */
export async function deployToolFromUrl(args) {
    const { url, tool_name, description = '' } = args;
    const u = new URL(url);
    const baseUrl = u.origin;
    const pathFromUrl = u.pathname || '/';
    const params = {};
    u.searchParams.forEach((v, k) => {
        params[k] = v;
    });
    const apiKeyNames = ['key', 'apiKey', 'api_key', 'apikey', 'token', 'auth'];
    let apiKeyParam = '';
    let apiKeyValue = '';
    for (const n of apiKeyNames) {
        if (params[n]) {
            apiKeyParam = n;
            apiKeyValue = params[n];
            break;
        }
    }
    if (!apiKeyParam && Object.keys(params).length > 0) {
        const first = Object.keys(params)[0];
        if (params[first]?.length >= 8 && /^[a-zA-Z0-9_-]+$/.test(params[first])) {
            apiKeyParam = first;
            apiKeyValue = params[first];
        }
    }
    if (!apiKeyParam || !apiKeyValue) {
        return deployPublicToolFromUrl(args);
    }
    const hostPart = u.hostname.replace(/^api\./, '').replace(/\./g, '_');
    const appId = `A1_${hostPart}`.substring(0, 64).replace(/[^a-zA-Z0-9_]/g, '_') || 'A1_api';
    const displayName = (tool_name || hostPart || 'API').replace(/[^a-zA-Z0-9_\s-]/g, '');
    try {
        await createConnection({ app_id: appId, display_name: displayName || appId });
    }
    catch (e1) {
        const msg = e1 instanceof Error ? e1.message : String(e1);
        if (!msg?.includes('already exists'))
            throw e1;
    }
    try {
        await createConnectionConfiguration(appId, 'draft', 'api_key', 'team', baseUrl);
    }
    catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        if (!msg?.includes('already') && !msg?.includes('exist'))
            throw e2;
    }
    await setApiKeyCredentials(appId, apiKeyValue, 'draft');
    const connData = await getConnection(appId);
    const apps = connData?.applications ?? (Array.isArray(connData) ? connData : connData ? [connData] : []);
    const connId = apps[0]?.connection_id || apps[0]?.app_id || appId;
    const openApiSpec = {
        openapi: '3.0.1',
        info: {
            title: tool_name,
            version: '1.0.0',
            description: description || `Tool for ${baseUrl}`,
            'x-ibm-skill-name': tool_name,
            'x-ibm-skill-id': tool_name.replace(/[^a-zA-Z0-9_-]/g, '_'),
        },
        servers: [{ url: baseUrl }],
        'x-ibm-connection-id': connId,
        'x-ibm-security': [{ type: 'apiKey', in: 'query', name: apiKeyParam }],
        paths: {
            [pathFromUrl]: {
                get: {
                    operationId: 'fetch',
                    summary: tool_name,
                    parameters: [
                        {
                            name: apiKeyParam,
                            in: 'query',
                            required: false,
                            schema: { type: 'string' },
                            description: 'API key (injected by connection)',
                        },
                        ...Object.keys(params)
                            .filter((k) => k !== apiKeyParam)
                            .map((k) => ({
                            name: k,
                            in: 'query',
                            required: false,
                            schema: { type: 'string' },
                            description: '',
                        })),
                    ],
                    responses: {
                        '200': {
                            description: 'Success',
                            content: { 'application/json': { schema: { type: 'object' } } },
                        },
                    },
                },
            },
        },
    };
    const toolSpec = {
        name: tool_name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, ''),
        description: description || `Tool for ${baseUrl}`,
        tool_type: 'openapi',
        permission: 'read_write',
    };
    const result = await deploySkill({ toolSpec, openApiSpec });
    return { ...result, appId };
}
/**
 * Deploy a tool from a PUBLIC API URL (no authentication). Use for REST Countries, Open-Meteo, etc.
 * Creates a standard tool with no connection.
 */
export async function deployPublicToolFromUrl(args) {
    const { url, tool_name, description = '' } = args;
    const u = new URL(url);
    const baseUrl = u.origin;
    let pathFromUrl = u.pathname || '/';
    const segments = pathFromUrl.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const isParam = lastSegment && !/^\d+$/.test(lastSegment) && lastSegment.length > 1;
    const paramName = pathFromUrl.includes('name') ? 'name' : pathFromUrl.includes('id') ? 'id' : 'q';
    if (isParam && segments.length > 0) {
        segments[segments.length - 1] = `{${paramName}}`;
        pathFromUrl = '/' + segments.join('/');
    }
    const pathParams = (pathFromUrl.match(/\{[^}]+\}/g) || []).map((p) => p.slice(1, -1));
    const queryParams = [];
    u.searchParams.forEach((v, k) => {
        queryParams.push({ name: k, in: 'query', required: false, schema: { type: 'string' }, description: '' });
    });
    const parameters = [
        ...pathParams.map((name) => ({
            name,
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: '',
        })),
        ...queryParams,
    ];
    if (parameters.length === 0) {
        parameters.push({ name: 'q', in: 'query', required: false, schema: { type: 'string' }, description: 'Query' });
    }
    const openApiSpec = {
        openapi: '3.0.1',
        info: {
            title: tool_name,
            version: '1.0.0',
            description: description || `Public API tool for ${baseUrl}`,
            'x-ibm-skill-name': tool_name,
            'x-ibm-skill-id': tool_name.replace(/[^a-zA-Z0-9_]/g, '_'),
        },
        servers: [{ url: baseUrl }],
        paths: {
            [pathFromUrl]: {
                get: {
                    operationId: 'fetch',
                    summary: tool_name,
                    parameters,
                    responses: {
                        '200': {
                            description: 'Success',
                            content: { 'application/json': { schema: { type: 'object' } } },
                        },
                    },
                },
            },
        },
    };
    const toolSpec = {
        name: tool_name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[^a-zA-Z_]+/, ''),
        description: description || `Public API tool for ${baseUrl}`,
        tool_type: 'openapi',
        permission: 'read_write',
    };
    const result = await deploySkill({ toolSpec, openApiSpec });
    return { ...result, appId: '' };
}
/**
 * Create a tool from URL and assign to agent – ONE step. Use for "create REST Countries tool and assign to TimeWeatherAgent".
 * Works with public APIs (no auth: REST Countries, Open-Meteo) and APIs with keys. Do NOT use ADK – use this MCP tool.
 */
export async function createToolAndAssignToAgent(args) {
    const { assignToolToAgent } = await import('./agents.js');
    const deployResult = await deployToolFromUrl({
        url: args.url,
        tool_name: args.tool_name,
        description: args.description,
    });
    const assignResult = await assignToolToAgent({
        tool_id: deployResult.toolId,
        agent_name: args.agent_name,
    });
    return {
        success: true,
        toolId: deployResult.toolId,
        agent_id: assignResult.agent_id,
        agent_name: assignResult.agent_name,
    };
}
/**
 * Test a URL locally (direct HTTP GET). Mirrors extension's "Run Local".
 * Use to verify an API endpoint without going through Watson Orchestrate.
 */
export async function testToolLocal(args) {
    const { url, params = {} } = args;
    const u = new URL(url);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const targetUrl = u.toString();
    const res = await fetch(targetUrl);
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = text;
    }
    return { success: res.ok, status: res.status, data };
}
