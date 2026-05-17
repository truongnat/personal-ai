#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import { setConfigValue, getConfigValue } from './config'
import { registerKbCommands } from './commands/kb'
import { registerSkillCommands } from './commands/skill'

const program = new Command()

program
  .name('skill')
  .description('Personal KB + Skill Hub CLI')
  .version('1.0.0')

// Config commands
const config = program.command('config').description('Manage CLI configuration')

config
  .command('set <key> <value>')
  .description('Set a config value')
  .action((key: string, value: string) => {
    setConfigValue(key as any, value)
    console.log(chalk.green(`✓ Set ${key}`))
  })

config
  .command('get <key>')
  .description('Get a config value')
  .action((key: string) => {
    const val = getConfigValue(key as any)
    console.log(val || chalk.dim('(not set)'))
  })

// KB commands (registered as nested `kb search`, `kb push`, etc.)
registerKbCommands(program)

// Skill commands (registered at top level: `install`, `publish`, etc.)
registerSkillCommands(program)

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red(err.message))
  process.exit(1)
})
