#!/usr/bin/env node

/**
 * KB + Skill Hub MCP Server
 * Provides Model Context Protocol integration with Claude Code and Cursor
 *
 * Enables:
 * - Search KB from IDE
 * - Push solutions from IDE
 * - Get tag suggestions
 * - Retrieve metrics
 * - Query GitHub-linked solutions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema, TextContent, Tool } from '@modelcontextprotocol/sdk/types.js'

const API_BASE = process.env.KB_API_URL || 'http://localhost:3456'
const API_KEY = process.env.KB_API_KEY || ''

// MCP Server setup
const server = new Server(
  {
    name: 'kb-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Available tools
const tools: Tool[] = [
  {
    name: 'kb_search',
    description: 'Search the knowledge base for solutions',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results (1-100)', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'kb_push',
    description: 'Push a new solution to the knowledge base',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Solution title' },
        content: { type: 'string', description: 'Solution markdown content' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for discovery' },
        project: { type: 'string', description: 'Project name' },
        github_issues: { type: 'array', items: { type: 'string' }, description: 'GitHub issue URLs' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'kb_suggest_tags',
    description: 'Get AI-powered tag suggestions for content',
    inputSchema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'Solution content to analyze' },
        project: { type: 'string', description: 'Project context (optional)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'kb_get_solution',
    description: 'Get full solution details by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Solution UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'kb_list',
    description: 'List solutions with optional filtering',
    inputSchema: {
      type: 'object' as const,
      properties: {
        tag: { type: 'string', description: 'Filter by tag' },
        project: { type: 'string', description: 'Filter by project' },
        limit: { type: 'number', description: 'Results per page', default: 20 },
        page: { type: 'number', description: 'Page number', default: 1 },
      },
    },
  },
  {
    name: 'kb_metrics',
    description: 'Get KB health metrics and statistics',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'kb_github_solutions',
    description: 'Find solutions linked to a GitHub issue/PR',
    inputSchema: {
      type: 'object' as const,
      properties: {
        repo: { type: 'string', description: 'GitHub repo (owner/repo)' },
        number: { type: 'number', description: 'Issue/PR number' },
      },
      required: ['repo', 'number'],
    },
  },
  {
    name: 'skill_list',
    description: 'List available skills',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'skill_get',
    description: 'Get detailed skill information',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Skill name' },
      },
      required: ['name'],
    },
  },
]

// Tool handlers
async function handleKbSearch(query: string, limit = 5) {
  const url = new URL(`${API_BASE}/kb/search`)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', Math.min(limit, 100).toString())

  const res = await fetch(url, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`KB search failed: ${res.statusText}`)
  return res.json()
}

async function handleKbPush(data: any) {
  const res = await fetch(`${API_BASE}/kb/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(data),
  })

  if (!res.ok) throw new Error(`KB push failed: ${res.statusText}`)
  return res.json()
}

async function handleKbSuggestTags(content: string, project?: string) {
  const res = await fetch(`${API_BASE}/kb/suggest-tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ content, project }),
  })

  if (!res.ok) throw new Error(`Tag suggestions failed: ${res.statusText}`)
  return res.json()
}

async function handleKbGetSolution(id: string) {
  const res = await fetch(`${API_BASE}/kb/${id}`, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`Failed to get solution: ${res.statusText}`)
  return res.json()
}

async function handleKbList(tag?: string, project?: string, limit = 20, page = 1) {
  const url = new URL(`${API_BASE}/kb/list`)
  if (tag) url.searchParams.set('tag', tag)
  if (project) url.searchParams.set('project', project)
  url.searchParams.set('limit', limit.toString())
  url.searchParams.set('page', page.toString())

  const res = await fetch(url, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`KB list failed: ${res.statusText}`)
  return res.json()
}

async function handleKbMetrics() {
  const res = await fetch(`${API_BASE}/kb/metrics`, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`Failed to get metrics: ${res.statusText}`)
  return res.json()
}

async function handleKbGithubSolutions(repo: string, number: number) {
  const url = new URL(`${API_BASE}/kb/github/search`)
  url.searchParams.set('repo', repo)
  url.searchParams.set('number', number.toString())

  const res = await fetch(url, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`GitHub search failed: ${res.statusText}`)
  return res.json()
}

async function handleSkillList() {
  const res = await fetch(`${API_BASE}/skill/list`, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`Skill list failed: ${res.statusText}`)
  return res.json()
}

async function handleSkillGet(name: string) {
  const res = await fetch(`${API_BASE}/skill/${name}`, {
    headers: { 'x-api-key': API_KEY },
  })

  if (!res.ok) throw new Error(`Failed to get skill: ${res.statusText}`)
  return res.json()
}

// Register request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request
  let result: any

  try {
    switch (name) {
      case 'kb_search':
        result = await handleKbSearch(args.query, args.limit)
        break
      case 'kb_push':
        result = await handleKbPush(args)
        break
      case 'kb_suggest_tags':
        result = await handleKbSuggestTags(args.content, args.project)
        break
      case 'kb_get_solution':
        result = await handleKbGetSolution(args.id)
        break
      case 'kb_list':
        result = await handleKbList(args.tag, args.project, args.limit, args.page)
        break
      case 'kb_metrics':
        result = await handleKbMetrics()
        break
      case 'kb_github_solutions':
        result = await handleKbGithubSolutions(args.repo, args.number)
        break
      case 'skill_list':
        result = await handleSkillList()
        break
      case 'skill_get':
        result = await handleSkillGet(args.name)
        break
      default:
        throw new Error(`Unknown tool: ${name}`)
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (err: any) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${err.message}`,
        },
      ],
      isError: true,
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[KB MCP Server] Connected and ready')
}

main().catch((err) => {
  console.error('[KB MCP Server] Fatal error:', err)
  process.exit(1)
})
