import { Command } from 'commander'
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { api } from '../api'
import { getConfig } from '../config'

function writeSkillFiles(skill: any) {
  const config = getConfig()
  const baseDir = resolve(config.skills_dir.replace('~', process.env.HOME ?? ''))
  const skillDir = join(baseDir, skill.name)
  mkdirSync(skillDir, { recursive: true })

  for (const [filePath, content] of Object.entries(skill.files as Record<string, string>)) {
    const fullPath = join(skillDir, filePath)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    if (dir) mkdirSync(dir, { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')
  }
}

function readSkillDir(dir: string): { name: string; version: string; description: string; compatible: string[]; files: Record<string, string>; tags: string[] } {
  const skillMd = readFileSync(join(dir, 'SKILL.md'), 'utf-8')
  const titleMatch = skillMd.match(/^#\s+(.+)/m)
  const name = titleMatch ? titleMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : 'unnamed'

  const files: Record<string, string> = {}
  function readDirRecursive(d: string, prefix = '') {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        readDirRecursive(join(d, entry.name), prefix + entry.name + '/')
      } else {
        const relPath = prefix + entry.name
        files[relPath] = readFileSync(join(d, entry.name), 'utf-8')
      }
    }
  }
  readDirRecursive(dir)

  return { name, version: '1.0.0', description: titleMatch?.[1] ?? '', compatible: [], files, tags: [] }
}

export function registerSkillCommands(program: Command) {
  program
    .command('install <name>')
    .description('Install a skill from the hub')
    .action(async (nameRaw: string) => {
      const [name, version] = nameRaw.split('@')
      const spinner = ora(`Installing ${name}...`).start()
      try {
        const url = version ? `/skill/install/${name}?version=${version}` : `/skill/install/${name}`
        const skill = await api.get<any>(url)
        writeSkillFiles(skill)
        spinner.succeed(chalk.green(`Installed ${skill.name}@${skill.version} → ${skill.install_path}`))
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  program
    .command('publish <dir>')
    .description('Publish a skill directory to the hub')
    .option('--version <v>', 'version', '1.0.0')
    .option('--compatible <tools>', 'comma-separated AI tools')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--changelog <msg>', 'changelog message')
    .action(async (dir: string, opts: any) => {
      const spinner = ora('Publishing...').start()
      try {
        const skill = readSkillDir(resolve(dir))
        if (opts.version) skill.version = opts.version
        if (opts.compatible) skill.compatible = opts.compatible.split(',').map((s: string) => s.trim())
        if (opts.tags) skill.tags = opts.tags.split(',').map((s: string) => s.trim())
        const data = await api.post<any>('/skill/publish', { ...skill, changelog: opts.changelog ?? '' })
        spinner.succeed(chalk.green(`Published ${data.name}@${data.version}`))
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  program
    .command('update [name]')
    .description('Update installed skill(s)')
    .option('--all', 'update all installed skills')
    .action(async (name: string | undefined, opts: { all?: boolean }) => {
      const config = getConfig()
      const baseDir = resolve(config.skills_dir.replace('~', process.env.HOME ?? ''))

      const names: string[] = opts.all
        ? readdirSync(baseDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : name ? [name] : []

      if (names.length === 0) {
        console.log(chalk.yellow('Specify a skill name or use --all'))
        return
      }

      for (const n of names) {
        const spinner = ora(`Updating ${n}...`).start()
        try {
          const skill = await api.get<any>(`/skill/install/${n}`)
          writeSkillFiles(skill)
          spinner.succeed(chalk.green(`Updated ${n}@${skill.version}`))
        } catch (err: any) {
          spinner.fail(`${n}: ${err.message}`)
        }
      }
    })

  program
    .command('list')
    .description('List installed skills')
    .action(async () => {
      const spinner = ora('Fetching skills...').start()
      try {
        const data = await api.get<any[]>('/skill/list')
        spinner.stop()
        for (const s of data) {
          console.log(chalk.bold(s.name) + chalk.dim(` v${s.latest_version}`))
          console.log(chalk.gray(`  ${s.description}`))
          if (s.compatible?.length) console.log(chalk.dim(`  Compatible: ${s.compatible.join(', ')}`))
          console.log()
        }
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  program
    .command('info <name>')
    .description('Show skill details')
    .action(async (name: string) => {
      const spinner = ora('Fetching...').start()
      try {
        const data = await api.get<any>(`/skill/${name}`)
        spinner.stop()
        console.log(chalk.bold.cyan(data.name) + chalk.dim(` (latest: ${data.latest_version})`))
        console.log(data.description)
        console.log(chalk.dim(`Compatible: ${data.compatible?.join(', ') ?? '—'}`))
        console.log(chalk.dim('\nVersions:'))
        for (const v of data.versions ?? []) {
          console.log(chalk.dim(`  ${v.version} — ${v.changelog || 'no notes'}`))
        }
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })

  program
    .command('compose')
    .description('Compose multiple skills into one')
    .requiredOption('--name <n>', 'name for the composed skill')
    .option('--use <skill>', 'skill to include (repeatable)', (v, acc: string[]) => { acc.push(v); return acc }, [] as string[])
    .option('--kb', 'inject kb:search and kb:push phases')
    .option('--out <file>', 'write composed SKILL.md to file')
    .action(async (opts: { name: string; use: string[]; kb?: boolean; out?: string }) => {
      const spinner = ora('Composing skills...').start()
      try {
        const data = await api.post<any>('/skill/compose', {
          name: opts.name,
          skills: opts.use,
          kb_integration: !!opts.kb,
        })
        spinner.stop()
        if (opts.out) {
          writeFileSync(opts.out, data.content, 'utf-8')
          console.log(chalk.green(`Written to ${opts.out}`))
        } else {
          console.log(data.content)
        }
        console.log(chalk.dim(`\nMerged: ${data.skills_merged.join(', ')}`))
      } catch (err: any) {
        spinner.fail(err.message)
        process.exit(1)
      }
    })
}
