import { woFetch } from './auth.js';
import { getDefaultModelId } from './models.js';
const TEST_AGENT_NAME = 'WxoBuilderTestAgent';
/**
 * List all available agents.
 * Uses same API as vscode-extension: GET /v1/orchestrate/agents
 */
export async function listAgents(limit = 20, offset = 0) {
    console.error(`Listing agents...`);
    try {
        const response = await woFetch(`/v1/orchestrate/agents?limit=${limit}&offset=${offset}`, {
            method: 'GET',
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to list agents: ${response.status} ${response.statusText} - ${text}`);
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
 * Get chat starter settings (welcome message, quick prompts) for an agent.
 */
export async function getChatStarterSettings(agentId) {
    try {
        const res = await woFetch(`/v1/orchestrate/agents/${agentId}/chat-starter-settings`, { method: 'GET' });
        if (!res.ok) {
            if (res.status === 404)
                return { starter_prompts: { prompts: [] }, welcome_content: {} };
            throw new Error(`Failed to get chat starter settings: ${res.status}`);
        }
        return await res.json();
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Update chat starter settings for an agent.
 */
export async function updateChatStarterSettings(agentId, payload) {
    const res = await woFetch(`/v1/orchestrate/agents/${agentId}/chat-starter-settings`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update chat starter settings: ${res.status} ${text}`);
    }
    return { success: true };
}
/**
 * Get a specific agent by ID.
 */
export async function getAgent(agentId) {
    console.error(`Getting agent ${agentId}...`);
    try {
        const response = await woFetch(`/v1/orchestrate/agents/${agentId}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to get agent: ${response.status} ${response.statusText}`);
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
 * Create a new Agent.
 * @param name Name of the agent
 * @param description Description
 * @param modelId The LLM model ID
 * @param instructions System prompt
 * @param tools Optional array of tool/skill IDs to assign to the agent
 */
export async function createAgent(name, description, modelId, instructions, tools) {
    console.error(`Creating agent "${name}"...`);
    const payload = {
        name,
        description,
        agent_type: 'watsonx',
        llm: modelId,
        instructions,
        style: 'default',
        settings: {},
    };
    try {
        const response = await woFetch('/v1/orchestrate/agents', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to create agent: ${response.status} ${response.statusText} - ${text}`);
        }
        const text = await response.text();
        let result;
        try {
            result = JSON.parse(text);
        }
        catch {
            result = text;
        }
        // If tools provided, update agent to assign them
        const agentId = result?.id ?? result?.data?.id ?? result;
        if (tools && tools.length > 0 && agentId) {
            await updateAgent(agentId, { tools });
            result.tools = tools;
        }
        return result;
    }
    catch (e) {
        throw new Error(`API Request Failed: ${e.message}`);
    }
}
/**
 * Update an agent by name or ID. Resolves agent_name to agent_id if needed.
 * If payload contains welcome_message or quick_prompts, also updates chat starter settings.
 */
export async function updateAgentByNameOrId(args) {
    const { agent_id, agent_name, payload } = args;
    let agentId = agent_id;
    if (!agentId && agent_name) {
        const resolved = await resolveAgentByName(agent_name);
        if (!resolved)
            throw new Error(`Agent not found: "${agent_name}"`);
        agentId = resolved;
    }
    if (!agentId)
        throw new Error('Provide agent_id or agent_name');
    const { welcome_message, quick_prompts, ...agentPayload } = payload;
    await updateAgent(agentId, agentPayload);
    if (welcome_message !== undefined || quick_prompts !== undefined) {
        const chatPayload = {};
        if (welcome_message !== undefined)
            chatPayload.welcome_content = { welcome_message: welcome_message || null };
        if (quick_prompts !== undefined)
            chatPayload.starter_prompts = { customize: quick_prompts };
        await updateChatStarterSettings(agentId, chatPayload);
    }
    return { success: true };
}
/**
 * Update an agent (e.g. assign tools, change model, instructions).
 */
export async function updateAgent(agentId, payload) {
    console.error(`Updating agent ${agentId}...`);
    const response = await woFetch(`/v1/orchestrate/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to update agent: ${response.status} ${text}`);
    }
    const text = await response.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return { success: true };
    }
}
/**
 * Delete an agent by ID.
 */
export async function deleteAgent(agentId) {
    console.error(`Deleting agent ${agentId}...`);
    const response = await woFetch(`/v1/orchestrate/agents/${agentId}`, { method: 'DELETE' });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete agent: ${response.status} ${text}`);
    }
    return { success: true };
}
/**
 * Resolve agent name to agent ID. Matches by name or display_name (case-insensitive, partial match).
 */
export async function resolveAgentByName(agentName) {
    const data = await listAgents(100, 0);
    let agents = [];
    if (Array.isArray(data))
        agents = data;
    else if (data?.assistants)
        agents = data.assistants;
    else if (data?.data)
        agents = data.data;
    const nameLower = agentName.toLowerCase().trim();
    const match = agents.find((a) => (a.name || '').toLowerCase() === nameLower ||
        (a.display_name || '').toLowerCase() === nameLower ||
        (a.name || '').toLowerCase().includes(nameLower) ||
        (a.display_name || '').toLowerCase().includes(nameLower));
    return match ? (match.id ?? null) : null;
}
/**
 * List tools assigned to an agent, with display names. Use agent_id or agent_name.
 * For queries like "which tools are assigned to TimeWeatherAgent".
 */
export async function listAgentTools(args) {
    const { listSkills } = await import('./skills.js');
    let agentId = args.agent_id;
    let agentName = '';
    if (!agentId && args.agent_name) {
        const resolved = await resolveAgentByName(args.agent_name);
        if (!resolved)
            throw new Error(`Agent not found: "${args.agent_name}"`);
        agentId = resolved;
        agentName = args.agent_name;
    }
    if (!agentId)
        throw new Error('Provide agent_id or agent_name');
    const agent = await getAgent(agentId);
    agentName = agent?.name || agent?.display_name || agentName || agentId;
    const rawTools = agent?.tools ?? agent?.skill_ids ?? agent?.skills ?? [];
    const toolIds = Array.isArray(rawTools)
        ? rawTools
            .map((t) => (typeof t === 'string' ? t : t?.id))
            .filter((id) => typeof id === 'string' && id.length > 0)
        : [];
    const skillsRaw = await listSkills(100, 0);
    const skillsList = Array.isArray(skillsRaw)
        ? skillsRaw
        : skillsRaw?.items ||
            skillsRaw?.tools ||
            skillsRaw?.data ||
            [];
    const idToMeta = new Map();
    for (const s of skillsList) {
        const id = s.id || s.name;
        if (id)
            idToMeta.set(id, { display_name: s.display_name || s.name || id, description: s.description });
    }
    const toolsWithNames = toolIds.map((id) => {
        const meta = idToMeta.get(id);
        return {
            id,
            display_name: meta?.display_name || id,
            ...(meta?.description ? { description: meta.description } : {}),
        };
    });
    return { agent_id: agentId, agent_name: agentName, tools: toolsWithNames };
}
/**
 * Assign a tool to an agent (add to existing tools). Use tool_name or tool_id, agent_name or agent_id.
 * For "assign REST Countries tool to TimeWeatherAgent" – use MCP, not ADK.
 */
export async function assignToolToAgent(args) {
    const { resolveToolByName } = await import('./skills.js');
    let toolId = args.tool_id;
    if (!toolId && args.tool_name) {
        const resolved = await resolveToolByName(args.tool_name);
        if (!resolved)
            throw new Error(`Tool not found: "${args.tool_name}"`);
        toolId = resolved;
    }
    if (!toolId)
        throw new Error('Provide tool_id or tool_name');
    let agentId = args.agent_id;
    if (!agentId && args.agent_name) {
        const resolved = await resolveAgentByName(args.agent_name);
        if (!resolved)
            throw new Error(`Agent not found: "${args.agent_name}"`);
        agentId = resolved;
    }
    if (!agentId)
        throw new Error('Provide agent_id or agent_name');
    const agent = await getAgent(agentId);
    const agentName = agent?.name || agent?.display_name || agentId;
    const rawTools = agent?.tools ?? agent?.skill_ids ?? agent?.skills ?? [];
    const existingIds = Array.isArray(rawTools)
        ? rawTools
            .map((t) => (typeof t === 'string' ? t : t?.id))
            .filter((id) => typeof id === 'string' && id.length > 0)
        : [];
    if (existingIds.includes(toolId)) {
        return { success: true, agent_id: agentId, agent_name: agentName, tools: existingIds };
    }
    const newTools = [...existingIds, toolId];
    await updateAgent(agentId, { tools: newTools });
    return { success: true, agent_id: agentId, agent_name: agentName, tools: newTools };
}
/**
 * Ensure the WxoBuilderTestAgent exists and has the given tool assigned.
 * Creates the agent if missing, then updates it to have this tool.
 * Returns the agent ID for use in remote tool runs.
 */
export async function ensureTestAgentForTool(toolId) {
    let agents = [];
    const data = await listAgents(100, 0);
    if (Array.isArray(data)) {
        agents = data;
    }
    else if (data?.assistants && Array.isArray(data.assistants)) {
        agents = data.assistants;
    }
    else if (data?.data && Array.isArray(data.data)) {
        agents = data.data;
    }
    const agent = agents.find((a) => (a.name || a.display_name) === TEST_AGENT_NAME);
    if (!agent) {
        const defaultLlm = await getDefaultModelId();
        const created = await createAgent(TEST_AGENT_NAME, 'WxO Builder internal agent for remote tool testing. Do not delete.', defaultLlm, 'When the user asks you to execute a tool, execute it and return the raw result. Do not add commentary.', [toolId]);
        const agentId = (created?.data?.id ?? created?.id ?? created);
        if (agentId)
            await updateAgent(agentId, { tools: [toolId] });
        return agentId;
    }
    const agentId = agent.id || agent;
    await updateAgent(agentId, { tools: [toolId] });
    return agentId;
}
/**
 * Update agent instructions based on assigned tools. Fetches tools, builds instructions from names/descriptions, and patches the agent.
 */
export async function updateAgentInstructionsFromTools(args) {
    const toolsResult = await listAgentTools(args);
    const { agent_id, agent_name, tools } = toolsResult;
    const knownPurposes = {
        'World Time': 'Get current time for any timezone (e.g. Europe/Amsterdam, America/New_York)',
        'Dad Jokes Skill': 'Tell random dad jokes',
        'mvk-weatherv4': 'Get current weather for locations worldwide',
        'REST Countries': 'Look up country data: population, area, capital, flags, languages',
        'Aviation Weather METAR': 'Get METAR weather reports for airport ICAO codes',
        'Currency Skill': 'Get currency exchange rates',
        'Asia Time Tool': 'Get current time for Asian timezones',
        'Asia Time Toolv3': 'Get current time for Asian timezones',
    };
    const bullets = tools.map((t) => {
        const purpose = t.description || knownPurposes[t.display_name] || `Use ${t.display_name} when relevant`;
        return `- **${t.display_name}**: ${purpose}`;
    });
    const instructions = `You are a helpful assistant with these capabilities. Use the appropriate tool when users ask:

${bullets.join('\n')}

Be concise and accurate. Cite the tool/source when providing data.`;
    await updateAgent(agent_id, { instructions });
    return { success: true, agent_id, agent_name, instructions };
}
/**
 * Invoke an agent by name or ID. Resolves agent_name to agent_id if needed.
 * Use for "ask TimeWeatherAgent what the exchange rate is CAD/USD" – no script, runs behind the scenes.
 */
export async function invokeAgentByNameOrId(args) {
    const { agent_id, agent_name, message } = args;
    if (!message)
        throw new Error('message is required');
    let agentId = agent_id;
    if (!agentId && agent_name) {
        const resolved = await resolveAgentByName(agent_name);
        if (!resolved)
            throw new Error(`Agent not found: "${agent_name}"`);
        agentId = resolved;
    }
    if (!agentId)
        throw new Error('Provide agent_id or agent_name');
    return invokeAgent(agentId, message);
}
/**
 * Invoke an Agent and poll for response.
 */
export async function invokeAgent(agentId, message) {
    console.error(`Invoking agent "${agentId}" with message: "${message}"...`);
    try {
        // 1. Start Run
        const runPayload = {
            agent_id: agentId,
            message: {
                role: 'user',
                content: message,
            },
        };
        const runRes = await woFetch('/v1/orchestrate/runs', {
            method: 'POST',
            body: JSON.stringify(runPayload),
        });
        if (!runRes.ok) {
            const text = await runRes.text();
            throw new Error(`Failed to start run: ${runRes.status} ${text}`);
        }
        const runData = await runRes.json();
        const threadId = runData.thread_id;
        const runId = runData.id;
        console.error(`Status: ${runData.status} (Thread: ${threadId})`);
        // 2. Poll for Completion
        // We poll the messages endpoint until we see an assistant response
        // that is newer than our request time (roughly)
        // OR we just wait a bit and check.
        // Better: Check run status first?
        // Findings said: "Polling /v1/orchestrate/threads/{thread_id}/messages"
        const foundResponse = false;
        let pollCount = 0;
        const maxPolls = 15; // 30s timeout
        while (!foundResponse && pollCount < maxPolls) {
            pollCount++;
            await new Promise((r) => setTimeout(r, 2000)); // Wait 2s
            // Check messages
            const msgRes = await woFetch(`/v1/orchestrate/threads/${threadId}/messages`, { method: 'GET' });
            if (msgRes.ok) {
                const data = await msgRes.json();
                const messages = data.data || data;
                if (Array.isArray(messages)) {
                    // Filter for assistant messages
                    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
                    if (assistantMsgs.length > 0) {
                        // Return the last message
                        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
                        // Extract text
                        let responseText = 'Unknown format';
                        if (typeof lastMsg.content === 'string') {
                            responseText = lastMsg.content;
                        }
                        else if (Array.isArray(lastMsg.content)) {
                            responseText = lastMsg.content
                                .map((c) => c.text?.value || c.text || JSON.stringify(c))
                                .join(' ');
                        }
                        return {
                            success: true,
                            response: responseText,
                            thread_id: threadId,
                            run_id: runId,
                        };
                    }
                }
            }
        }
        throw new Error('Timed out waiting for assistant response.');
    }
    catch (e) {
        throw new Error(`Agent Invocation Failed: ${e.message}`);
    }
}
