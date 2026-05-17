import { Command } from 'commander'
import { readFileSync } from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { api } from '../api'
import { getConfig } from '../config'

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m)
  return match ? match[1].trim() : 'Untitled'
}

function printResults(data: any) {
  const { results, total, cached } = data
  console.log(chalk.dim(`Found ${total} result(s)${cached ? ' (cached)' : ''}\n`))
  for (const r of results) {
    console.log(chalk.bold.cyan(`[${r.score?.toFixed ? r.score.toFixed(2) : '—'}] ${r.title}`))
    console.log(chalk.dim(`  ID: ${r.id}`))
    if (r.ticket_ref) console.log(chalk.dim(`  Ticket: ${r.ticket_ref}`))
    if (r.tags?.length) console.log(chalk.dim(`  Tags: ${r.tags.join(', ')}`))
    console.log(chalk.gray(`  ${r.summary ?? ''}`))
    if (r.related?.length) {
      console.log(chalk.dim(`  Related: ${r.related.map((x: any) => x.title).join(', ')}`))
    }
    console.log()
  }
}

export function registerKbCommands(program: Command) {
  const kb = program.command('kb').description('Knowledge Base commands')

  kb
    .command('search <query>')
    .description('Search knowledge base')
    .option('-l, --limit <n>', 'number of results', '5')
    .action(async (query: string, opts: { limit: string }) => {
      const spinner = ora('Searching...').start()
      try {
        const data = await api.get<any>(`/kb/search?q=${encodeURIComponent(query)}&limit=${opts.limit}`)
        spinner.stop()
        printResults(data)
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  kb
    .command('push <file>')
    .description('Push solution to knowledge base')
    .option('-t, --tags <tags>', 'comma-separated tags')
    .option('--ticket <ref>', 'ticket reference')
    .option('--project <name>', 'project name')
    .action(async (file: string, opts: { tags?: string; ticket?: string; project?: string }) => {
      const spinner = ora('Pushing solution...').start()
      try {
        const content = readFileSync(file, 'utf-8')
        const title = extractTitle(content)
        const config = getConfig()
        const data = await api.post<any>('/kb/push', {
          title,
          content,
          tags: opts.tags ? opts.tags.split(',').map((t) => t.trim()) : [],
          ticket_ref: opts.ticket,
          project: opts.project ?? config.default_project || undefined,
        })
        spinner.succeed(chalk.green(`Pushed: ${title}`))
        console.log(chalk.dim(`  ID: ${data.id}`))
        console.log(chalk.dim(`  Related found: ${data.related_found}`))
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  kb
    .command('list')
    .description('List knowledge base entries')
    .option('--tag <tag>', 'filter by tag')
    .option('--project <project>', 'filter by project')
    .option('--page <n>', 'page number', '1')
    .option('--limit <n>', 'items per page', '20')
    .action(async (opts: { tag?: string; project?: string; page: string; limit: string }) => {
      const spinner = ora('Fetching...').start()
      try {
        const params = new URLSearchParams()
        if (opts.tag) params.set('tag', opts.tag)
        if (opts.project) params.set('project', opts.project)
        params.set('page', opts.page)
        params.set('limit', opts.limit)
        const data = await api.get<any>(`/kb/list?${params}`)
        spinner.stop()
        console.log(chalk.dim(`Total: ${data.total} | Page ${data.page}/${Math.ceil(data.total / data.limit)}\n`))
        for (const item of data.items) {
          console.log(chalk.bold(item.title) + chalk.dim(` [${item.id}]`))
          if (item.ticket_ref) console.log(chalk.dim(`  ${item.ticket_ref}`))
          console.log(chalk.gray(`  ${item.summary ?? ''}`))
          console.log()
        }
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  kb
    .command('get <id>')
    .description('Get full solution content')
    .action(async (id: string) => {
      const spinner = ora('Fetching...').start()
      try {
        const data = await api.get<any>(`/kb/${id}`)
        spinner.stop()
        console.log(chalk.bold.cyan(`# ${data.title}`))
        console.log(chalk.dim(`Tags: ${data.tags?.join(', ')} | Ticket: ${data.ticket_ref ?? '—'}`))
        console.log()
        console.log(data.content)
        if (data.related?.length) {
          console.log(chalk.dim('\nRelated:'))
          for (const r of data.related) {
            console.log(chalk.dim(`  • ${r.title} [${r.id}]`))
          }
        }
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })
}
