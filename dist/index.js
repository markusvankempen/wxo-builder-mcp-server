/**
 * Watson Orchestrate MCP Server
 * Parities vscode-extension functionality: tools, agents, connections, flows.
 *
 * @author Markus van Kempen
 * @license Apache-2.0
 */
import * as z from 'zod';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { validateConfig } from './config.js';
import { listSkills, listToolsWithConnections, listStandardTools, getSkill, deleteSkill, deploySkill, updateSkill, copySkill, resolveToolByName, executeTool, deployToolFromUrl, createToolAndAssignToAgent, testToolLocal, } from './skills.js';
import { listAgents, createAgent, invokeAgentByNameOrId, getAgent, getChatStarterSettings, updateChatStarterSettings, updateAgentByNameOrId, updateAgentInstructionsFromTools, deleteAgent, listAgentTools, assignToolToAgent, } from './agents.js';
import { listFlows, createFlow, deleteFlow, getFlow } from './flows.js';
import { listConnectors, listConnections, listConnectionsAll, listActiveLiveConnections, getConnection, createConnection, deleteConnection, createConnectionConfiguration, setApiKeyCredentials, setBasicCredentials, setBearerCredentials, } from './connections.js';
dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_PATH = join(__dirname, '..', 'watson-orchestrate-openapi.json');
const optionalNum = () => z.number().optional();
const optionalStr = () => z.string().optional();
async function runTool(handler) {
    if (!validateConfig()) {
        throw new Error('Missing configuration. Set WO_API_KEY and WO_INSTANCE_URL in .env');
    }
    const result = await handler();
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
}
async function main() {
    const server = new McpServer({ name: 'wxo-builder-mcp-server', version: '1.0.0' }, { capabilities: {} });
    // --- SKILLS ---
    server.registerTool('get_api_spec', {
        description: 'Get the Watson Orchestrate OpenAPI spec. Describes all REST endpoints the MCP server uses (tools, agents, connections, flows, runs). Use to understand what operations the Watson Orchestrate instance supports.',
        inputSchema: { format: z.enum(['full', 'summary']).optional() },
    }, async (args, _extra) => {
        try {
            const spec = JSON.parse(readFileSync(OPENAPI_PATH, 'utf-8'));
            if (args?.format === 'summary') {
                const summary = {
                    title: spec.info?.title,
                    paths: Object.keys(spec.paths || {}),
                    operations: Object.entries(spec.paths || {}).flatMap(([path, methods]) => Object.keys(methods)
                        .filter((m) => ['get', 'post', 'patch', 'put', 'delete'].includes(m))
                        .map((m) => `${m.toUpperCase()} ${path}`)),
                };
                return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
            }
            return { content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }] };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                content: [{ type: 'text', text: `Failed to load OpenAPI spec: ${msg}` }],
                isError: true,
            };
        }
    });
    server.registerTool('list_skills', {
        description: 'List all available tools/skills in the Watson Orchestrate catalog',
        inputSchema: { limit: optionalNum(), offset: optionalNum() },
    }, async (args, _extra) => runTool(() => listSkills(args?.limit, args?.offset)));
    server.registerTool('list_tools_with_connections', {
        description: 'List Watson Orchestrate tools grouped by connection status: tools that require an API key/OAuth connection vs standard tools. Matches the extension Tools view. Use for prompts like "list my tools with active connections".',
        inputSchema: { limit: optionalNum() },
    }, async (args, _extra) => runTool(() => listToolsWithConnections(args?.limit)));
    server.registerTool('list_standard_tools', {
        description: "List only standard tools (tools with no connections). Returns accurate count and list from Watson Orchestrate. Use for 'list standard tools' or 'tools with no connections' – tools with empty/missing security and connection_id. Do not guess; use this tool for accurate data.",
        inputSchema: { limit: optionalNum() },
    }, async (args, _extra) => runTool(() => listStandardTools(args?.limit)));
    server.registerTool('execute_tool', {
        description: 'Execute a Watson Orchestrate tool by name or ID. Use for prompts like "execute News Search Tool" or "run the Weather tool". Resolves tool names (e.g. "News Search Tool") to IDs, ensures an agent has the tool, then invokes it. Pass parameters as a JSON object if the tool requires them.',
        inputSchema: {
            tool_name: z.string().optional(),
            tool_id: z.string().optional(),
            parameters: z.record(z.string(), z.any()).optional(),
            agent_id: z.string().optional(),
        },
    }, async (args, _extra) => runTool(() => executeTool({
        tool_name: args?.tool_name,
        tool_id: args?.tool_id,
        parameters: args?.parameters,
        agent_id: args?.agent_id,
    })));
    server.registerTool('get_skill', {
        description: 'Get a specific skill/tool by ID. Returns tool details including display name, description, and binding.',
        inputSchema: { skill_id: z.string() },
    }, async (args, _extra) => runTool(() => getSkill(args.skill_id)));
    server.registerTool('delete_skill', {
        description: 'Delete a skill by ID',
        inputSchema: { skill_id: z.string() },
    }, async (args, _extra) => runTool(() => deleteSkill(args.skill_id)));
    server.registerTool('deploy_skill', {
        description: 'Deploy a tool from OpenAPI spec. Set openapi_spec["x-ibm-connection-id"] to bind a connection.',
        inputSchema: {
            tool_spec: z.record(z.string(), z.any()),
            openapi_spec: z.record(z.string(), z.any()),
        },
    }, async (args, _extra) => runTool(() => deploySkill({ toolSpec: args.tool_spec, openApiSpec: args.openapi_spec })));
    server.registerTool('update_skill', {
        description: 'Update a tool (name, display_name, description, permission)',
        inputSchema: {
            skill_id: z.string(),
            skill_json: z.record(z.string(), z.any()),
        },
    }, async (args, _extra) => runTool(() => updateSkill(args.skill_id, args.skill_json)));
    server.registerTool('copy_skill', {
        description: 'Copy a tool. Creates a new tool with same spec and connection. Use new_name (e.g. "MVKWeatherV2") for a custom name. Names must use only letters, digits, underscores.',
        inputSchema: {
            skill_id: z.string(),
            skill_name: z.string().optional(),
            new_name: z.string().optional(),
        },
    }, async (args, _extra) => {
        const skillId = args?.skill_id;
        const skillName = args?.skill_name;
        if (!skillId && !skillName)
            throw new Error('Provide skill_id or skill_name');
        return runTool(async () => {
            let id = skillId ?? null;
            if (!id && skillName) {
                id = await resolveToolByName(skillName);
                if (!id)
                    throw new Error(`Tool not found: "${skillName}"`);
            }
            if (!id)
                throw new Error('Provide skill_id or skill_name');
            return copySkill(id, args?.new_name);
        });
    });
    server.registerTool('deploy_tool_from_url', {
        description: 'Create a tool from a URL. Works with: (1) APIs with API key – auto-creates connection, (2) Public APIs (REST Countries, Open-Meteo) – no auth needed. Use this MCP tool, NOT ADK.',
        inputSchema: {
            url: z.string(),
            tool_name: z.string(),
            description: optionalStr(),
        },
    }, async (args, _extra) => runTool(() => deployToolFromUrl({
        url: args.url,
        tool_name: args.tool_name,
        description: args?.description,
    })));
    server.registerTool('create_tool_and_assign_to_agent', {
        description: "Create a tool from URL and assign to agent – ONE step. Use for 'create REST Countries tool and assign to TimeWeatherAgent'. Works with public APIs (no auth) and APIs with keys. Use this MCP tool, do NOT use ADK.",
        inputSchema: {
            url: z.string(),
            tool_name: z.string(),
            agent_name: z.string(),
            description: optionalStr(),
        },
    }, async (args, _extra) => runTool(() => createToolAndAssignToAgent({
        url: args.url,
        tool_name: args.tool_name,
        agent_name: args.agent_name,
        description: args?.description,
    })));
    server.registerTool('assign_tool_to_agent', {
        description: 'Assign a tool to an agent (add to toolkit). Use tool_name or tool_id, agent_name or agent_id. For "assign REST Countries to TimeWeatherAgent" – use MCP, not ADK.',
        inputSchema: {
            tool_id: z.string().optional(),
            tool_name: z.string().optional(),
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
        },
    }, async (args, _extra) => {
        if (!args?.tool_id && !args?.tool_name)
            throw new Error('Provide tool_id or tool_name');
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(() => assignToolToAgent(args));
    });
    server.registerTool('test_tool_local', {
        description: 'Test an API endpoint locally (direct HTTP GET). Use for "run locally" or "test locally". Does not go through Watson Orchestrate.',
        inputSchema: {
            url: z.string(),
            params: z.record(z.string(), z.string()).optional(),
        },
    }, async (args, _extra) => runTool(() => testToolLocal({ url: args.url, params: args?.params })));
    // --- AGENTS ---
    server.registerTool('list_agents', {
        description: 'List all available agents',
        inputSchema: { limit: optionalNum(), offset: optionalNum() },
    }, async (args, _extra) => runTool(() => listAgents(args?.limit, args?.offset)));
    server.registerTool('create_agent', {
        description: 'Create an agent. Pass tools array to assign tool IDs.',
        inputSchema: {
            name: z.string(),
            description: z.string(),
            model_id: z.string(),
            instructions: z.string(),
            tools: z.array(z.string()).optional(),
        },
    }, async (args, _extra) => runTool(() => createAgent(args.name, args.description, args.model_id, args.instructions, args?.tools)));
    server.registerTool('get_agent', {
        description: 'Get agent details by ID. Returns config, assigned tools, instructions, and model.',
        inputSchema: { agent_id: z.string() },
    }, async (args, _extra) => runTool(() => getAgent(args.agent_id)));
    server.registerTool('get_agent_chat_starter_settings', {
        description: 'Get chat starter settings for an agent: welcome message and quick prompts. Use agent_id or agent_name.',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
        },
    }, async (args, _extra) => {
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(async () => {
            const { resolveAgentByName } = await import('./agents.js');
            let agentId = args?.agent_id;
            if (!agentId && args?.agent_name) {
                const r = await resolveAgentByName(args.agent_name);
                if (!r)
                    throw new Error(`Agent not found: "${args.agent_name}"`);
                agentId = r;
            }
            return getChatStarterSettings(agentId);
        });
    });
    server.registerTool('update_agent_chat_starter_settings', {
        description: 'Update chat starter settings: welcome_message, quick_prompts (array of {title, prompt}). Use agent_id or agent_name.',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
            welcome_message: z.string().optional(),
            quick_prompts: z.array(z.object({
                title: z.string(),
                prompt: z.string(),
                subtitle: z.string().optional(),
            })).optional(),
        },
    }, async (args, _extra) => {
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(async () => {
            const { resolveAgentByName } = await import('./agents.js');
            let agentId = args?.agent_id;
            if (!agentId && args?.agent_name) {
                const r = await resolveAgentByName(args.agent_name);
                if (!r)
                    throw new Error(`Agent not found: "${args.agent_name}"`);
                agentId = r;
            }
            const payload = {};
            if (args?.welcome_message !== undefined) {
                payload.welcome_content = { welcome_message: args.welcome_message || null };
            }
            if (args?.quick_prompts !== undefined) {
                payload.starter_prompts = {
                    customize: args.quick_prompts.map((p) => ({
                        title: p.title,
                        prompt: p.prompt,
                        ...(p.subtitle ? { subtitle: p.subtitle } : {}),
                    })),
                };
            }
            if (Object.keys(payload).length === 0)
                throw new Error('Provide welcome_message or quick_prompts');
            return updateChatStarterSettings(agentId, payload);
        });
    });
    server.registerTool('list_agent_tools', {
        description: 'List tools assigned to an agent, with display names and descriptions when available. Use agent_name (e.g. "TimeWeatherAgent") or agent_id. For "which tools are assigned to TimeWeatherAgent". Returns accurate tool list from Watson Orchestrate.',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
        },
    }, async (args, _extra) => {
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(() => listAgentTools({ agent_id: args?.agent_id, agent_name: args?.agent_name }));
    });
    server.registerTool('update_agent', {
        description: 'Update an agent. Use agent_name (e.g. "TimeWeatherAgent") or agent_id. Pass payload with instructions, tools, description, etc. For "update TimeWeatherAgent instructions" use agent_name and payload: { instructions: "..." }.',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
            payload: z.record(z.string(), z.any()),
        },
    }, async (args, _extra) => {
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(() => updateAgentByNameOrId({
            agent_id: args?.agent_id,
            agent_name: args?.agent_name,
            payload: args.payload,
        }));
    });
    server.registerTool('update_agent_instructions_from_tools', {
        description: 'Update an agent\'s instructions based on its assigned tools. Fetches tools, builds helpful instructions, and patches the agent. Use for "update TimeWeatherAgent instructions based on its tools".',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
        },
    }, async (args, _extra) => {
        if (!args?.agent_id && !args?.agent_name)
            throw new Error('Provide agent_id or agent_name');
        return runTool(() => updateAgentInstructionsFromTools({
            agent_id: args?.agent_id,
            agent_name: args?.agent_name,
        }));
    });
    server.registerTool('invoke_agent', {
        description: 'Chat with an agent. Use agent_name (e.g. "TimeWeatherAgent") or agent_id. For "ask TimeWeatherAgent what the exchange rate is CAD/USD" – use agent_name and message. Runs behind the scenes, no script needed.',
        inputSchema: {
            agent_id: z.string().optional(),
            agent_name: z.string().optional(),
            message: z.string(),
        },
    }, async (args, _extra) => {
        if (!args?.message)
            throw new Error('message is required');
        return runTool(() => invokeAgentByNameOrId(args));
    });
    server.registerTool('delete_agent', {
        description: 'Delete an agent by ID',
        inputSchema: { agent_id: z.string() },
    }, async (args, _extra) => runTool(() => deleteAgent(args.agent_id)));
    // --- CONNECTIONS ---
    server.registerTool('list_connectors', {
        description: 'List available connector applications from the catalog',
        inputSchema: { limit: optionalNum() },
    }, async (args, _extra) => runTool(() => listConnectors(args?.limit)));
    server.registerTool('list_connections', {
        description: 'List configured connections (scope: draft, live, or all)',
        inputSchema: { scope: z.enum(['draft', 'live', 'all']).optional() },
    }, async (args, _extra) => {
        const scope = args?.scope || 'all';
        return runTool(() => (scope === 'all' ? listConnectionsAll() : listConnections(scope)));
    });
    server.registerTool('list_active_live_connections', {
        description: "List only active and live connections (not tools). Returns deduplicated connection names. Use for 'list all connections which are active and live, just the connections not the tools'.",
        inputSchema: {},
    }, async (_args, _extra) => runTool(() => listActiveLiveConnections()));
    server.registerTool('get_connection', {
        description: 'Get a connection by app_id',
        inputSchema: { app_id: z.string() },
    }, async (args, _extra) => runTool(() => getConnection(args.app_id)));
    server.registerTool('create_connection', {
        description: 'Create a connection. Then use configure_connection for credentials.',
        inputSchema: { app_id: z.string(), display_name: optionalStr() },
    }, async (args, _extra) => runTool(() => createConnection({ app_id: args.app_id, display_name: args?.display_name || args.app_id })));
    server.registerTool('delete_connection', {
        description: 'Delete a connection by app_id',
        inputSchema: { app_id: z.string() },
    }, async (args, _extra) => runTool(() => deleteConnection(args.app_id)));
    server.registerTool('configure_connection', {
        description: 'Configure connection credentials (api_key, basic, bearer)',
        inputSchema: {
            app_id: z.string(),
            kind: z.enum(['api_key', 'basic', 'bearer']),
            env: z.enum(['draft', 'live']).optional(),
            api_key: optionalStr(),
            username: optionalStr(),
            password: optionalStr(),
            token: optionalStr(),
            server_url: optionalStr(),
        },
    }, async (args, _extra) => {
        if (!validateConfig())
            throw new Error('Missing configuration. Set WO_API_KEY and WO_INSTANCE_URL in .env');
        const appId = args.app_id;
        const kind = args.kind;
        const env = (args?.env || 'draft');
        await createConnectionConfiguration(appId, env, kind, 'team', args?.server_url);
        if (kind === 'api_key') {
            if (!args?.api_key)
                throw new Error('api_key required for kind=api_key');
            await setApiKeyCredentials(appId, args.api_key, env);
        }
        else if (kind === 'basic') {
            if (!args?.username || !args?.password)
                throw new Error('username and password required for kind=basic');
            await setBasicCredentials(appId, args.username, args.password, env);
        }
        else if (kind === 'bearer') {
            if (!args?.token)
                throw new Error('token required for kind=bearer');
            await setBearerCredentials(appId, args.token, env);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ success: true, message: `Connection ${appId} configured for ${env}` }, null, 2),
                },
            ],
        };
    });
    // --- FLOWS ---
    server.registerTool('list_flows', {
        description: 'List all available flows',
        inputSchema: { limit: optionalNum(), offset: optionalNum() },
    }, async (args, _extra) => runTool(() => listFlows(args?.limit, args?.offset)));
    server.registerTool('create_flow', {
        description: 'Create or update a flow',
        inputSchema: { flow_json: z.record(z.string(), z.any()) },
    }, async (args, _extra) => runTool(() => createFlow(args.flow_json)));
    server.registerTool('get_flow', {
        description: 'Get a flow by ID',
        inputSchema: { flow_id: z.string() },
    }, async (args, _extra) => runTool(() => getFlow(args.flow_id)));
    server.registerTool('delete_flow', {
        description: 'Delete a flow by ID',
        inputSchema: { flow_id: z.string() },
    }, async (args, _extra) => runTool(() => deleteFlow(args.flow_id)));
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Watson Orchestrate (WXO) Builder MCP Server running on stdio');
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
