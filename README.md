# WXO Builder MCP Server

MCP server for IBM Watson Orchestrate (WXO). Manage tools, agents, connections, flows, and execute tools from Cursor, VS Code Copilot, Claude Desktop, or the WxO Builder extension.

## Install from npm

```bash
npm install @markusvankempen/wxo-builder-mcp
```

## Quick Start

1. **Set environment variables** (or use `.env`):

```env
WO_API_KEY=<your_ibm_cloud_api_key>
WO_INSTANCE_URL=https://<your-instance-id>.orchestrate.ibm.com
```

2. **Configure your MCP client** to run the server. Example for Cursor (`.cursor/mcp.json`):

```json
{
    "mcpServers": {
        "watsonx": {
            "command": "npx",
            "args": ["-y", "@markusvankempen/wxo-builder-mcp"],
            "env": {
                "WO_API_KEY": "your-api-key",
                "WO_INSTANCE_URL": "https://xxx.orchestrate.ibm.com"
            }
        }
    }
}
```

3. **Or use the bundled path** after `npm install` (for VS Code / Copilot):

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "node",
            "args": ["./node_modules/@markusvankempen/wxo-builder-mcp/dist/index.js"],
            "env": {
                "WO_API_KEY": "...",
                "WO_INSTANCE_URL": "https://...orchestrate.ibm.com"
            }
        }
    }
}
```

## Features (Parity with VS Code Extension)

### OpenAPI Spec

- **`watson-orchestrate-openapi.json`** – OpenAPI 3.0 spec describing the Watson Orchestrate REST API used by this MCP server (tools, agents, connections, flows, runs). Use `get_api_spec` to retrieve it.
- **`get_api_spec`** – Returns the OpenAPI spec (full or summary). Use to discover what operations the Watson Orchestrate instance supports.

### Tools (Skills)

- **`list_skills`** – List all tools in the catalog (default limit 100)
- **`list_tools_with_connections`** – List tools grouped by connection status (tools with connections vs standard tools). **Matches the extension Tools view.** Use for prompts like “list my Watson Orchestrate tools with active connections”.
- **`list_standard_tools`** – List only standard tools (no connections). Returns accurate count and list.
- **`get_skill`** – Get a tool by ID
- **`delete_skill`** – Delete a tool
- **`deploy_skill`** – Create a tool from OpenAPI spec. Set `openapi_spec["x-ibm-connection-id"]` to **bind a connection** to the tool
- **`deploy_tool_from_url`** – Create a tool from a URL. Handles (1) APIs with API key → auto-creates connection, (2) public APIs (REST Countries, Open-Meteo) → no auth. Use this MCP tool, NOT ADK.
- **`create_tool_and_assign_to_agent`** – Create a tool from URL and assign to agent in one step. Use for "create REST Countries tool and assign to TimeWeatherAgent". Works with public APIs and APIs with keys. Use this MCP tool, do NOT use ADK.
- **`assign_tool_to_agent`** – Assign a tool to an agent by `tool_name`/`tool_id` and `agent_name`/`agent_id`.
- **`update_skill`** – Update name, description, permission (binding/connection not editable after creation)
- **`copy_skill`** – Copy a tool. Use `new_name` (e.g. "MVKWeatherV2") to name the copy. Keeps connection and parameters. Names: letters, digits, underscores only.
- **`execute_tool`** – Execute a tool by name or ID. Use for prompts like "execute News Search Tool" or "run the Weather tool". Resolves tool names to IDs, ensures an agent has the tool, then invokes it.

### Agents

- **`list_agents`** – List all agents
- **`get_agent`** – Get agent by ID
- **`get_agent_chat_starter_settings`** – Get welcome message and quick prompts for an agent (by name or ID)
- **`update_agent_chat_starter_settings`** – Update `welcome_message` and `quick_prompts` (array of `{title, prompt}`)
- **`list_agent_tools`** – List tools assigned to an agent (by name or ID) with display names and descriptions. Use for "which tools are assigned to TimeWeatherAgent".
- **`create_agent`** – Create an agent. Pass `tools` array to **assign tools** to the agent
- **`update_agent`** – Update an agent. Use `agent_name` or `agent_id`. Payload: `instructions`, `tools`, `style`, `tags`, `hidden`, `hide_reasoning`, `welcome_message`, `quick_prompts`.
- **`update_agent_instructions_from_tools`** – Auto-generate and set instructions from assigned tools (names and descriptions)
- **`invoke_agent`** – Chat with an agent. Use `agent_name` (e.g. "TimeWeatherAgent") or `agent_id`. Runs behind the scenes – no script needed.
- **`delete_agent`** – Delete an agent

### Connections

- **`list_connectors`** – List available connector catalog
- **`list_connections`** – List configured connections (scope: draft, live, all)
- **`list_active_live_connections`** – List only active and live connections (not tools), deduplicated. Use for "list all connections which are active and live, just the connections".
- **`get_connection`** – Get connection by app_id
- **`create_connection`** – Create a connection entry
- **`delete_connection`** – Delete a connection
- **`configure_connection`** – Set credentials (api_key, basic, bearer) for a connection

### Flows

- **`list_flows`**, **`get_flow`**, **`create_flow`**, **`delete_flow`**

## Configuration

Set these environment variables (or use a `.env` file):

```env
WO_API_KEY=<your_ibm_cloud_api_key>
WO_INSTANCE_URL=https://<your-instance-id>.orchestrate.ibm.com
```

## Running Locally

```bash
npm install
npm run build
node dist/index.js
```

## Integration Tests

The test suite validates MCP parity with the extension using **user-style test questions**. See [`tests/README.md`](tests/README.md) for full documentation. Test questions are defined in `tests/test-questions.ts` – add new ones to extend validation.

```bash
# With WO credentials (runs all 4 tests)
WO_API_KEY=... WO_INSTANCE_URL=... npm run test:integration

# Without WO credentials (runs local execution test only)
npm run test:integration
```

**Test questions:** List live connections | Copy tool with new name | List standard tools | Create MVKWeather from URL | Execute locally (Toronto) | Execute remotely | Agent chat (Toronto weather) | Exchange rate (TimeWeatherAgent) | Create REST Countries and assign to TimeWeatherAgent | List agent tools

## Assigning Tools to Agents

Use `create_agent` or `update_agent` with a `tools` array of tool IDs:

```json
{
    "name": "My Agent",
    "description": "...",
    "model_id": "groq/openai/gpt-oss-120b",
    "instructions": "...",
    "tools": ["tool-id-1", "tool-id-2"]
}
```

## Assigning Connections to Tools

When deploying a tool with `deploy_skill`, include `x-ibm-connection-id` in the OpenAPI spec (or the connection’s app_id) to bind a connection:

```json
{
  "tool_spec": { "name": "my_tool", "description": "..." },
  "openapi_spec": {
    "openapi": "3.0.1",
    "info": { "title": "My Tool", "version": "1.0.0" },
    "x-ibm-connection-id": "YOUR_APP_ID",
    "paths": { ... }
  }
}
```

## VS Code / Claude Desktop / Cursor

**Important:** MCP config does **not** go in VS Code `settings.json`. Use the correct config file for your editor.

### VS Code (with GitHub Copilot)

Config file: **`.vscode/mcp.json`** (workspace) or run **MCP: Open User Configuration** for global.

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "node",
            "args": ["/Users/YOUR_USERNAME/.vscode/extensions/markusvankempen.wxo-builder-0.0.6/server/dist/index.js"],
            "env": {
                "WO_API_KEY": "...",
                "WO_INSTANCE_URL": "https://...orchestrate.ibm.com"
            }
        }
    }
}
```

### Cursor

Config file: **`.cursor/mcp.json`** (project) or `~/.cursor/mcp.json` (global). Uses `mcpServers` (not `servers`).

### Bundled path (WxO Builder extension)

If you installed the WxO Builder VSIX, the MCP server is at:

```
~/.vscode/extensions/markusvankempen.wxo-builder-0.0.6/server/dist/index.js
```

Use the **full absolute path** (replace `~` with `/Users/your-username` on macOS). MCP spawns `node` and needs a resolvable path; relative paths fail.

### Standalone (from repo)

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "node",
            "args": ["/path/to/packages/mcp-server/dist/index.js"],
            "env": {
                "WO_API_KEY": "...",
                "WO_INSTANCE_URL": "https://...orchestrate.ibm.com"
            }
        }
    }
}
```

## Publishing (for maintainers)

### Publish to npm

```bash
cd packages/mcp-server
npm run build
npm publish --access public
```

### Publish to MCP Registry

1. Install the MCP publisher CLI: `brew install mcp-publisher`
2. Log in: `mcp-publisher login github`
3. Update `server.json` version to match `package.json`
4. Publish: `mcp-publisher publish`

The server will appear at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) as `io.github.markusvankempen/wxo-builder`.

## Implementation: TypeScript vs Node.js

This MCP server is written in **TypeScript** and compiled to JavaScript. Like the [Maximo MCP server](https://github.com/markusvankempen/Maximo-MCP), it can load an OpenAPI spec (`watson-orchestrate-openapi.json`) for documentation and discovery.

**Why TypeScript for Watson Orchestrate:**

- Larger codebase (skills, agents, connections, flows, auth, models)
- Type safety for Watson Orchestrate’s varied API responses
- Easier to maintain and extend across multiple modules

**When plain Node.js fits:**

- Smaller, single-file servers (e.g. Maximo MCP)
- No build step required
- Quick prototyping

## License

Apache-2.0
