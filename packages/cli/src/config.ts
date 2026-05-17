import Conf from 'conf'

export interface CliConfig {
  hub_url: string
  api_key: string
  skills_dir: string
  default_project: string
}

const store = new Conf<CliConfig>({
  projectName: 'skill-cli',
  schema: {
    hub_url: { type: 'string', default: '' },
    api_key: { type: 'string', default: '' },
    skills_dir: { type: 'string', default: `${process.env.HOME}/.claude/skills` },
    default_project: { type: 'string', default: '' },
  },
})

export function getConfig(): CliConfig {
  return {
    hub_url: store.get('hub_url'),
    api_key: store.get('api_key'),
    skills_dir: store.get('skills_dir'),
    default_project: store.get('default_project'),
  }
}

export function setConfigValue(key: keyof CliConfig, value: string): void {
  store.set(key, value)
}

export function getConfigValue(key: keyof CliConfig): string {
  return store.get(key) as string
}
