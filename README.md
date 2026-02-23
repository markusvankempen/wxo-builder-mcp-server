# WXO Builder MCP Server

[![npm version](https://img.shields.io/npm/v/wxo-builder-mcp-server.svg)](https://www.npmjs.com/package/wxo-builder-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/wxo-builder-mcp-server.svg)](https://www.npmjs.com/package/wxo-builder-mcp-server)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

<p align="center">
  <img src="https://unpkg.com/wxo-builder-mcp-server/resources/icon.svg" alt="WXO Builder MCP Server" width="96" height="96"/>
</p>

<p align="center">
  <a href="https://cursor.directory/mcp/wxo-builder-mcp-server"><img src="https://img.shields.io/badge/Add_to_Cursor-WXO%20Builder%20MCP-0f62fe?style=for-the-badge" alt="Add MCP server to Cursor" /></a>
</p>

**Version** 1.0.4 · **Author** [Markus van Kempen](mailto:markus.van.kempen@gmail.com) · **Date** 2026-02-20

MCP server for IBM Watson Orchestrate (WXO). Manage tools, agents, connections, flows, and execute tools from Cursor, VS Code Copilot, Claude Desktop, Antigravity, Windsurf, or the WxO Builder extension.

[markusvankempen.github.io](https://markusvankempen.github.io) · [WxO Builder extension](https://marketplace.visualstudio.com/items?itemName=MarkusvanKempen.wxo-builder) · [CONTRIBUTING](CONTRIBUTING.md) · [CHANGELOG](CHANGELOG.md) · [PUBLISHING](PUBLISHING.md) · [LICENSE](LICENSE)

## Architecture & Data Flow

This package has a **dual role**:

1. **MCP protocol:** It acts as an **MCP server** — your AI environment (Cursor, Claude Desktop, VS Code Copilot, Antigravity, Windsurf, etc.) is the MCP *client* that connects to it and calls tools.
2. **Watson Orchestrate:** It acts as an **HTTP client** — it makes REST requests to your Watson Orchestrate instance. Watson Orchestrate never connects back to this process.

```
┌─────────────────────────────────┐     MCP protocol      ┌──────────────────────────┐     HTTP (REST API)     ┌─────────────────────────┐
│  MCP Client                     │  ◄──────────────────► │  WXO Builder MCP Server │  ───────────────────►  │  Watson Orchestrate     │
│  (Cursor, Claude Desktop,       │     tool calls        │  (this package)          │     /v1/orchestrate/*  │  instance                │
│   Copilot, Antigravity, etc.)    │                       │                         │                        │  (your WO cloud/hosted)  │
└─────────────────────────────────┘                       └──────────────────────────┘                        └─────────────────────────┘
```

The MCP server exposes tools that proxy operations to Watson Orchestrate. When you invoke a tool (e.g. `list_skills`, `invoke_agent`), the server forwards the request to the Watson Orchestrate API and returns the result.

## Related: WxO Builder Extension + MCP Server – a perfect combo

The **WxO Builder** extension and this **MCP Server** work together to create and administer Watson Orchestrate directly from your IDE. Use the extension for visual editing and the MCP server for AI-powered workflows (Cursor, Claude Desktop, etc.).

| | Link |
|---|------|
| **WxO Builder extension** | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=MarkusvanKempen.wxo-builder) |
| **Open VSX** | [open-vsx.org/extension/markusvankempen/wxo-builder](https://open-vsx.org/extension/markusvankempen/wxo-builder) |
| **Author** | [markusvankempen.github.io](https://markusvankempen.github.io) |
| **MCP Registry** | [registry.modelcontextprotocol.io/?q=wxo-builder-mcp-server](https://registry.modelcontextprotocol.io/?q=wxo-builder-mcp-server) |
| **Source Code** | [github.com/markusvankempen/wxo-builder-vscode-extension](https://github.com/markusvankempen/wxo-builder-vscode-extension) |

The extension provides visual tool creation, drag-and-drop agent editing, and local/remote testing. The MCP server exposes the same Watson Orchestrate capabilities to AI assistants in Cursor, Claude Desktop, Antigravity, Windsurf, and VS Code Copilot.

### Directory listing copy (cursor.directory, etc.)

**Cursor Deep Link** (use this so the install dialog shows "WxO Builder MCP Server"):

```
cursor://anysphere.cursor-deeplink/mcp/install?name=WxO%20Builder%20MCP%20Server&config=eyJXeE8gQnVpbGRlciBNQ1AgU2VydmVyIjp7ImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwiQG1hcmt1c3ZhbmtlbXBlbi93eG8tYnVpbGRlci1tY3Atc2VydmVyIl0sImVudiI6eyJXT19BUElfS0VZIjoieW91ci1hcGkta2V5IiwiV09fSU5TVEFOQ0VfVVJMIjoiaHR0cHM6Ly95b3VyLWluc3RhbmNlLm9yY2hlc3RyYXRlLmlibS5jb20ifX19
```

Config JSON for [Cursor deeplink generator](https://docs.cursor.com/deeplinks):

```json
{
  "WxO Builder MCP Server": {
    "command": "npx",
    "args": ["-y", "wxo-builder-mcp-server"],
    "env": {
      "WO_API_KEY": "your-api-key",
      "WO_INSTANCE_URL": "https://your-instance.orchestrate.ibm.com",
      "WO_AGENT_IDs": "agent-id-1,agent-id-2"
    }
  }
}
```

When `WO_AGENT_IDs` (comma-separated list) or `WO_AGENT_ID` is set, agent-based tools use the first ID as default when the user does not specify an agent.

**Short description (≤100 chars):**

> Manage Watson Orchestrate tools, agents, connections. Pair with [WxO Builder extension](https://marketplace.visualstudio.com/items?itemName=MarkusvanKempen.wxo-builder).

**Longer description:**

> Manage IBM Watson Orchestrate (WXO) tools, agents, connections, and flows from Cursor, Copilot, or Claude. Best used with the [WxO Builder VS Code extension](https://marketplace.visualstudio.com/items?itemName=MarkusvanKempen.wxo-builder) for a full IDE experience: visual tool creation, drag-and-drop agents, and local/remote testing.

---

**Distribution options:**

- **npm** – Install `wxo-builder-mcp-server` (recommended)
- **MCP Registry** – [registry.modelcontextprotocol.io/?q=wxo-builder-mcp-server](https://registry.modelcontextprotocol.io/?q=wxo-builder-mcp-server)
- **Standalone repo** – [github.com/markusvankempen/wxo-builder-mcp-server](https://github.com/markusvankempen/wxo-builder-mcp-server) for cloning just the MCP server
- **Devkit** – This package is also part of the [watsonx-orchestrate-devkit](https://github.com/markusvankempen/watsonx-orchestrate-devkit) at `packages/wxo-builder-mcp-server` (shared with the WxO Builder extension)

## Install from npm

```bash
npm install wxo-builder-mcp-server
```

### One-click install in Cursor

**[Add to Cursor](cursor://anysphere.cursor-deeplink/mcp/install?name=WxO%20Builder%20MCP%20Server&config=eyJXeE8gQnVpbGRlciBNQ1AgU2VydmVyIjp7ImNvbW1hbmQiOiJucHgiLCJhcmdzIjpbIi15IiwiQG1hcmt1c3ZhbmtlbXBlbi93eG8tYnVpbGRlci1tY3Atc2VydmVyIl0sImVudiI6eyJXT19BUElfS0VZIjoieW91ci1hcGkta2V5IiwiV09fSU5TVEFOQ0VfVVJMIjoiaHR0cHM6Ly95b3VyLWluc3RhbmNlLm9yY2hlc3RyYXRlLmlibS5jb20ifX19)** — Click to install (shows "WxO Builder MCP Server"). Then set `WO_API_KEY` and `WO_INSTANCE_URL` in Cursor MCP settings.

## Quick Start

1. **Set environment variables** (or use `.env`):

```env
WO_API_KEY=<your_ibm_cloud_api_key>
WO_INSTANCE_URL=https://<your-instance-id>.orchestrate.ibm.com

# Optional: default agent(s) when user omits agent_id/agent_name (first is used)
WO_AGENT_IDs=agent-id-1,agent-id-2
# Or single agent (backwards compatible):
# WO_AGENT_ID=<your-agent-id>
```

When `WO_AGENT_IDs` (comma-separated) or `WO_AGENT_ID` is set, tools use the first ID as default when the user does not specify an agent.

2. **Configure your MCP client** – use `npx` so you never reference `.js` paths. Example for Cursor (`.cursor/mcp.json`):

```json
{
    "mcpServers": {
        "watsonx": {
            "command": "npx",
            "args": ["-y", "wxo-builder-mcp-server"],
            "env": {
                "WO_API_KEY": "your-api-key",
                "WO_INSTANCE_URL": "https://xxx.orchestrate.ibm.com"
            }
        }
    }
}
```

VS Code Copilot uses `servers` instead of `mcpServers`; same `command` and `args`:

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "wxo-builder-mcp-server"],
            "env": {
                "WO_API_KEY": "...",
                "WO_INSTANCE_URL": "https://...orchestrate.ibm.com"
            }
        }
    }
}
```

### Example configs

Copy-ready example files are in [`examples/`](examples/):

| File | Use for |
|------|---------|
| `examples/.vscode/mcp.json` | VS Code / GitHub Copilot → copy to `.vscode/mcp.json` |
| `examples/.cursor/mcp.json` | Cursor → copy to `.cursor/mcp.json` |
| `examples/claude-desktop-config.json` | Claude Desktop → merge into `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `examples/antigravity-mcp-config.json` | Antigravity → add to `mcp_config.json` via Manage MCP Servers |
| `examples/windsurf-mcp-config.json` | Windsurf → copy to `~/.codeium/windsurf/mcp_config.json` |
| `examples/env.example` | Optional `.env` for env vars |

See [`examples/README.md`](examples/README.md) for details.

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
- **`deploy_tool_from_url`** – Create a tool from a URL. Handles (1) APIs with API key → auto-creates connection, (2) public APIs (REST Countries, Open-Meteo) → no auth.
- **`create_python_tool_from_tool_spec_json`** – Create a Python tool from `tool-spec.json` content. Pass the raw JSON string plus `python_code` and `requirements`. Use when user says "create a tool from this tool-spec.json" (e.g. [CreatingZipFileBasedonDocuments](https://github.com/markusvankempen/watsonx-orchestrate-devkit/tree/main/packages/vscode-extension/tests/fixtures/CreatingZipFileBasedonDocuments)).
- **`create_python_tool_and_upload`** – Create a Python tool and upload its artifact in one step. `tool_spec`, `python_code`, optional `requirements`, `python_filename`.
- **`create_tool_and_assign_to_agent`** – Create a tool from URL and assign to agent in one step. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`assign_tool_to_agent`** – Assign a tool to an agent. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`update_skill`** – Update name, description, permission (binding/connection not editable after creation)
- **`copy_skill`** – Copy a tool. Use `new_name` (e.g. "MVKWeatherV2") to name the copy. Keeps connection and parameters. Names: letters, digits, underscores only.
- **`execute_tool`** – Execute a tool by name or ID. `agent_id` optional; uses first from `WO_AGENT_IDs` when omitted.

### Agents

- **`list_agents`** – List all agents
- **`get_agent`** – Get agent by ID or name. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`get_agent_chat_starter_settings`** – Get welcome message and quick prompts. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`update_agent_chat_starter_settings`** – Update `welcome_message` and `quick_prompts`. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`list_agent_tools`** – List tools assigned to an agent with display names. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`create_agent`** – Create an agent. Pass `tools` array to **assign tools** to the agent
- **`update_agent`** – Update an agent. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`update_agent_instructions_from_tools`** – Auto-generate and set instructions from assigned tools. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
- **`invoke_agent`** – Chat with an agent. `agent_id`/`agent_name` optional if `WO_AGENT_IDs` is set.
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

## Client Compatibility

The MCP server is tested and works with:

| Client | Config | Notes |
|--------|--------|------|
| **Cursor** | `examples/.cursor/mcp.json` | stdio, npx or node |
| **VS Code Copilot** | `examples/.vscode/mcp.json` | Use `servers` key, `type: "stdio"` |
| **Antigravity** | `examples/antigravity-mcp-config.json` | Add via Manage MCP Servers |
| **Langflow** | STDIO or JSON mode | Output flattened for DataFrame; list tools have no limit/offset params |

**Langflow:** Tool output is normalized to a list of flat dicts (primitive values only) so the MCP Tools component's DataFrame validation passes. Nested objects (e.g. `binding`, `input_schema`) are JSON-stringified. Cursor, VS Code, and Antigravity receive the same format and work identically.

**Verification:** Run `npm run test:integration` with `WO_API_KEY` and `WO_INSTANCE_URL` to validate core functionality. For Cursor/VS Code: add the server, ask "List my Watson Orchestrate tools" or "Which agents do I have?" For Langflow: add MCP server, connect MCP Tools to an Agent, run the flow.

## Configuration

Set these environment variables (or use a `.env` file):

```env
WO_API_KEY=<your_ibm_cloud_api_key>
WO_INSTANCE_URL=https://<your-instance-id>.orchestrate.ibm.com

# Optional: default agent(s) when user omits agent_id/agent_name (first is used)
WO_AGENT_IDs=agent-id-1,agent-id-2
```

See [Quick Start](#quick-start) for full details on `WO_AGENT_IDs` and `WO_AGENT_ID`.

## Troubleshooting

**"Process exited with code 2" / "MCP server could not be started"**

1. **Ensure credentials are set** – `WO_API_KEY` and `WO_INSTANCE_URL` must be in your MCP config `env` block or in a `.env` file.
2. **Verify the server runs manually** – From a terminal:
   ```bash
   WO_API_KEY=your-key WO_INSTANCE_URL=https://xxx.orchestrate.ibm.com npx -y wxo-builder-mcp-server
   ```
   It should start and wait. Press Ctrl+C to exit.
3. **Check Node version** – Requires Node.js 18+.
4. **WxO Builder extension** – Ensure **API Key** and **Instance URL** are set in extension settings (search `wxo-builder` in VS Code settings).

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

**Test questions:** List live connections | Copy tool | List standard tools | Create MVKWeather from URL | Execute locally/remotely | Agent chat | Exchange rate | REST Countries + assign | List agent tools | Create tool from tool-spec.json (CreatingZipFileBasedonDocuments) | Agent Conversation ZIP | Download tool artifact

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

## Editor configuration (VS Code, Cursor, Claude Desktop, Antigravity, Windsurf)

**Important:** MCP config does **not** go in VS Code `settings.json`. Use the correct config file for your editor.

### VS Code (with GitHub Copilot)

Config file: **`.vscode/mcp.json`** (workspace) or run **MCP: Open User Configuration** for global. Use `npx` (no .js path needed):

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "wxo-builder-mcp-server"],
            "env": {
                "WO_API_KEY": "...",
                "WO_INSTANCE_URL": "https://...orchestrate.ibm.com"
            }
        }
    }
}
```

### Cursor

Config file: **`.cursor/mcp.json`** (project) or `~/.cursor/mcp.json` (global). Uses `mcpServers` (not `servers`). Same `command` and `args` as above.

### Antigravity (Google)

Open **Manage MCP Servers → View raw config** and add the `watsonx` entry from `examples/antigravity-mcp-config.json` to your `mcp_config.json`. Same `mcpServers` format as Cursor.

### Windsurf (Codeium)

Config file: **`~/.codeium/windsurf/mcp_config.json`** (macOS/Linux) or **`%USERPROFILE%\.codeium\windsurf\mcp_config.json`** (Windows). Use `examples/windsurf-mcp-config.json`. Same `mcpServers` format as Cursor. Restart Windsurf after changes.

### Alternative: WxO Builder extension bundled server

If you installed the WxO Builder VSIX and want to use its bundled server (no npm install), use the extension path:

```json
"command": "node",
"args": ["/Users/YOUR_USERNAME/.vscode/extensions/markusvankempen.wxo-builder-0.0.6/server/dist/index.js"]
```

### Local build (devkit or standalone repo)

If you clone the devkit or the [standalone repo](https://github.com/markusvankempen/wxo-builder-mcp-server), build and run via `npx` using the package directory (no .js path):

```bash
cd packages/wxo-builder-mcp-server   # devkit
# or
cd wxo-builder-mcp-server            # standalone repo

npm install && npm run build
```

```json
{
    "servers": {
        "watsonx": {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "/path/to/wxo-builder-mcp-server"],
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

From the devkit or standalone repo:

```bash
cd packages/wxo-builder-mcp-server   # devkit
# or
cd .                                 # standalone repo root

npm run build
npm publish --access public
```

### Publish to MCP Registry

1. Install the MCP publisher CLI: `brew install mcp-publisher`
2. Log in: `mcp-publisher login github`
3. Update `server.json` version to match `package.json`
4. Publish: `mcp-publisher publish`

The server will appear at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) as `io.github.markusvankempen/wxo-builder-mcp-server`.

## Implementation: TypeScript vs Node.js

This MCP server is written in **TypeScript** and compiled to JavaScript. It loads an OpenAPI spec (`watson-orchestrate-openapi.json`) for documentation and discovery.

**Why TypeScript for Watson Orchestrate:**

- Larger codebase (skills, agents, connections, flows, auth, models)
- Type safety for Watson Orchestrate’s varied API responses
- Easier to maintain and extend across multiple modules

## License

Apache-2.0 — See [LICENSE](LICENSE). [CONTRIBUTING](CONTRIBUTING.md) · [CHANGELOG](CHANGELOG.md)
