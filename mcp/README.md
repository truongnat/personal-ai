# KB + Skill Hub MCP Server

Model Context Protocol (MCP) server for seamless integration of the Personal KB + Skill Hub with Claude Code and Cursor IDE.

## Features

- **KB Search** — Search solutions directly from your IDE
- **Push Solutions** — Save findings to KB without leaving your editor
- **Tag Suggestions** — AI-powered tagging recommendations
- **GitHub Integration** — Find KB solutions linked to issues/PRs
- **Metrics Dashboard** — View KB health and coverage statistics
- **Skill Hub Access** — Browse and reference available skills
- **Multi-IDE Support** — Works with Claude Code and Cursor

## Installation

### Prerequisites

- Node.js 18+
- Valid KB API key (set `KB_API_KEY` environment variable)
- KB API running (default: `http://localhost:3456`)

### Claude Code

1. Install the server locally:

```bash
cd mcp
npm install
npm run build
```

2. Update your Claude Code settings (`~/.claude/config.json`):

```json
{
  "mcp": {
    "servers": [
      {
        "type": "stdio",
        "name": "kb-mcp",
        "command": "node",
        "args": ["/path/to/personal-ai/mcp/kb-mcp-server.ts"],
        "env": {
          "KB_API_URL": "http://localhost:3456",
          "KB_API_KEY": "your-api-key-here"
        }
      }
    ]
  }
}
```

3. Restart Claude Code. The KB tools will now be available in your prompts.

### Cursor

1. Install the server:

```bash
cd mcp
npm install
npm run build
```

2. Update Cursor settings (Command Palette → "Cursor Settings"):

```json
{
  "mcp": {
    "servers": [
      {
        "type": "stdio",
        "name": "kb-mcp",
        "command": "node",
        "args": ["/path/to/personal-ai/mcp/kb-mcp-server.ts"],
        "env": {
          "KB_API_URL": "http://localhost:3456",
          "KB_API_KEY": "your-api-key-here"
        }
      }
    ]
  }
}
```

3. Restart Cursor. Use the MCP tools in composer or chat contexts.

## Available Tools

### `kb_search`

Search the knowledge base for solutions.

```
Input: { query: string, limit?: number }
Output: { results: Solution[], total: number, cached: boolean }
```

**Example:**
```
kb_search({ query: "neo4j constraint", limit: 5 })
```

### `kb_push`

Push a new solution to the KB.

```
Input: {
  title: string
  content: string
  tags?: string[]
  project?: string
  github_issues?: string[]
}
Output: { id: string, message: string, related_found: number }
```

**Example:**
```
kb_push({
  title: "Fix Neo4j Constraint Race Condition",
  content: "## Problem\n...",
  tags: ["neo4j", "constraints", "concurrency"],
  project: "personal-ai"
})
```

### `kb_suggest_tags`

Get AI-powered tag suggestions for content.

```
Input: { content: string, project?: string }
Output: { suggestedTags: Tag[], topicSummary: string }
```

### `kb_get_solution`

Get full solution details by ID.

```
Input: { id: string }
Output: Solution
```

### `kb_list`

List solutions with optional filtering.

```
Input: { tag?: string, project?: string, limit?: number, page?: number }
Output: { items: Solution[], total: number, page: number, limit: number }
```

### `kb_metrics`

Get KB health metrics and statistics.

```
Output: KbMetrics
```

### `kb_github_solutions`

Find solutions linked to a GitHub issue/PR.

```
Input: { repo: string, number: number }
Output: Solution[]
```

### `skill_list`

List all available skills.

```
Output: Skill[]
```

### `skill_get`

Get detailed skill information.

```
Input: { name: string }
Output: Skill
```

## Workflow Examples

### Search Before Work

In Claude Code or Cursor, before starting a task:

```
kb_search({ query: "docker compose neo4j setup" })
```

### Document a Solution

After solving a problem:

```
kb_push({
  title: "Redis Connection Pool Exhaustion Fix",
  content: "## Problem\nRedis pool was being exhausted...",
  tags: ["redis", "connection-pooling", "debugging"],
  project: "personal-ai"
})
```

### Link to GitHub Issue

When solving a GitHub issue:

```
kb_push({
  title: "Fix #123: Solution versioning API",
  content: "...",
  tags: ["versioning", "api"],
  github_issues: ["truongnat/personal-ai#123"]
})
```

## Configuration

### Environment Variables

- `KB_API_URL` — KB API base URL (default: `http://localhost:3456`)
- `KB_API_KEY` — API authentication key (required)

### API Key Generation

Generate a new API key:

```bash
curl -X POST http://localhost:3456/auth/keys \
  -H "x-master-password: your-master-password"
```

## Troubleshooting

### Server won't connect

- Check that KB API is running: `curl http://localhost:3456/health`
- Verify `KB_API_KEY` is set correctly
- Check Claude Code / Cursor logs for errors

### Commands return errors

- Verify API key has `x-api-key` permission
- Check KB API logs: `make logs`
- Ensure content being pushed is valid markdown

### Slow responses

- KB search results are cached for 5 minutes
- Metrics are cached for 1 hour
- Check API performance: `curl http://localhost:3456/kb/metrics`

## Development

### Build the server

```bash
cd mcp
npm install
npm run build
```

### Test locally

```bash
# Terminal 1: Start KB API
make up
cd apps/api && bun run start:dev

# Terminal 2: Run MCP server
cd mcp
export KB_API_KEY=your-test-key
npm run dev
```

### Add new tools

1. Add tool definition to `tools` array
2. Implement handler function
3. Add case to `CallToolRequestSchema` handler
4. Test with Claude Code/Cursor

## Security

- API key is transmitted in Authorization header
- Recommend using HTTPS for production deployments
- Rotate API keys regularly
- Keep `KB_API_KEY` out of version control

## Support

- Issues: https://github.com/truongnat/personal-ai/issues
- Documentation: See main project README
