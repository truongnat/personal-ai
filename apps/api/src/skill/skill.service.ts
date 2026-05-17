import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { Neo4jService } from '../neo4j/neo4j.service'
import { SearchService } from '../search/search.service'
import { PublishSkillDto } from './dto/publish-skill.dto'
import { ComposeSkillDto } from './dto/compose-skill.dto'
import { UpdateSkillDto } from './dto/update-skill.dto'

const KB_SEARCH_BLOCK = `
## Phase 0: kb:search (TRƯỚC KHI BẮT ĐẦU)
- Chạy: \`skill kb:search "{ticket_title}"\`
- Đọc kết quả, check related solutions
- Nếu có solution tương tự → adapt và note lại
- Nếu không có → tiến hành investigate bình thường
`

const KB_PUSH_BLOCK = `
## Phase DONE: kb:push (SAU KHI CLOSE TICKET)
- Viết solution.md theo template chuẩn
- Chạy: \`skill kb:push ./solution.md --tags x,y --ticket TICKET-ID\`
- Verify pushed: \`skill kb:search "{ticket_title}"\`
`

@Injectable()
export class SkillService {
  constructor(
    private neo4j: Neo4jService,
    private search: SearchService,
  ) {}

  async publish(dto: PublishSkillDto): Promise<{ name: string; version: string; published_at: string }> {
    const now = new Date().toISOString()
    const versionId = uuidv4()
    const compatible = dto.compatible ?? []
    const tags = dto.tags ?? []

    await this.neo4j.runQuery(
      `MERGE (s:Skill { name: $name })
       ON CREATE SET s.id = $id, s.created_at = $now
       SET s.description = $description,
           s.latest_version = $version,
           s.updated_at = $now`,
      { name: dto.name, description: dto.description, version: dto.version, now, id: uuidv4() },
    )

    await this.neo4j.runQuery(
      `MATCH (s:Skill { name: $name })
       CREATE (v:SkillVersion {
         id: $versionId,
         version: $version,
         changelog: $changelog,
         files: $files,
         published_at: $now
       })
       CREATE (s)-[:HAS_VERSION]->(v)`,
      {
        name: dto.name,
        versionId,
        version: dto.version,
        changelog: dto.changelog ?? '',
        files: JSON.stringify(dto.files),
        now,
      },
    )

    // Batch AITool linking with UNWIND (single query instead of N)
    if (compatible.length > 0) {
      await this.neo4j.runQuery(
        `UNWIND $compatible AS toolName
         MERGE (t:AITool { name: toolName })
         WITH t
         MATCH (s:Skill { name: $name })
         MERGE (s)-[:COMPATIBLE_WITH]->(t)`,
        { compatible, name: dto.name },
      )
    }

    // Batch tag linking with UNWIND (single query instead of N)
    if (tags.length > 0) {
      await this.neo4j.runQuery(
        `UNWIND $tags AS tagName
         MERGE (t:Tag { name: tagName })
         WITH t
         MATCH (s:Skill { name: $name })
         MERGE (s)-[:TAGGED_WITH]->(t)`,
        { tags, name: dto.name },
      )
    }

    await this.search.indexDocument('skills', {
      id: dto.name,
      name: dto.name,
      description: dto.description,
      tags,
      compatible,
      latest_version: dto.version,
    })

    return { name: dto.name, version: dto.version, published_at: now }
  }

  async install(name: string, version?: string): Promise<any> {
    let versionQuery = `MATCH (s:Skill { name: $name })-[:HAS_VERSION]->(v:SkillVersion)`
    const params: any = { name }

    if (version) {
      versionQuery += ` WHERE v.version = $version`
      params.version = version
    }

    const result = await this.neo4j.runQuery(
      versionQuery + ` RETURN s, v ORDER BY v.published_at DESC LIMIT 1`,
      params,
    )

    if (result.records.length === 0) throw new NotFoundException(`Skill ${name} not found`)

    const rec = result.records[0]
    const s = rec.get('s').properties
    const v = rec.get('v').properties

    return {
      name: s.name,
      version: v.version,
      files: JSON.parse(v.files),
      install_path: `.claude/skills/${name}/`,
    }
  }

  async searchSkills(query: string) {
    const { hits } = await this.search.search('skills', query, { limit: 10 })
    return { results: hits, total: hits.length }
  }

  async list() {
    const result = await this.neo4j.runQuery(
      `MATCH (s:Skill)
       OPTIONAL MATCH (s)-[:COMPATIBLE_WITH]->(t:AITool)
       RETURN s, collect(t.name) AS tools ORDER BY s.updated_at DESC`,
    )
    return result.records.map((r) => {
      const s = r.get('s').properties
      return {
        name: s.name,
        description: s.description,
        latest_version: s.latest_version,
        compatible: r.get('tools'),
        updated_at: s.updated_at,
      }
    })
  }

  async getByName(name: string) {
    const result = await this.neo4j.runQuery(
      `MATCH (s:Skill { name: $name })
       OPTIONAL MATCH (s)-[:HAS_VERSION]->(v:SkillVersion)
       OPTIONAL MATCH (s)-[:COMPATIBLE_WITH]->(t:AITool)
       RETURN s,
         collect(DISTINCT { version: v.version, changelog: v.changelog, published_at: v.published_at }) AS versions,
         collect(DISTINCT t.name) AS tools`,
      { name },
    )
    if (result.records.length === 0) throw new NotFoundException(`Skill ${name} not found`)

    const rec = result.records[0]
    const s = rec.get('s').properties
    return {
      name: s.name,
      description: s.description,
      latest_version: s.latest_version,
      compatible: rec.get('tools'),
      versions: rec.get('versions'),
      created_at: s.created_at,
      updated_at: s.updated_at,
    }
  }

  async update(name: string, dto: UpdateSkillDto) {
    await this.getByName(name)
    if (dto.version && dto.files) {
      return this.publish({
        name,
        version: dto.version,
        description: dto.description ?? '',
        compatible: dto.compatible,
        changelog: dto.changelog,
        files: dto.files,
        tags: dto.tags,
      })
    }
    const now = new Date().toISOString()
    await this.neo4j.runQuery(
      `MATCH (s:Skill { name: $name })
       SET s.description = coalesce($description, s.description),
           s.updated_at = $now`,
      { name, description: dto.description ?? null, now },
    )
    return { name, message: 'Updated successfully' }
  }

  async delete(name: string) {
    await this.neo4j.runQuery(
      `MATCH (s:Skill { name: $name }) DETACH DELETE s`,
      { name },
    )
    await this.search.deleteDocument('skills', name)
    return { message: 'Deleted successfully' }
  }

  async compose(dto: ComposeSkillDto): Promise<{ name?: string; content: string; skills_merged: string[] }> {
    const sections: string[] = []

    if (dto.name) {
      sections.push(`# ${dto.name}`)
      if (dto.description) sections.push(`\n${dto.description}\n`)
    }

    // Install all skills in parallel instead of serial
    const installed = await Promise.all(dto.skills.map((skillName) => this.install(skillName)))

    for (let i = 0; i < dto.skills.length; i++) {
      const skillName = dto.skills[i]
      const skillMd: string = installed[i].files['SKILL.md'] ?? ''
      const withoutH1 = skillMd.replace(/^#\s.+\n/, '')
      sections.push(`\n---\n\n<!-- from: ${skillName} -->\n${withoutH1}`)
    }

    if (dto.kb_integration) {
      sections.push(KB_SEARCH_BLOCK)
      sections.push(KB_PUSH_BLOCK)
    }

    return {
      name: dto.name,
      content: sections.join('\n'),
      skills_merged: dto.skills,
    }
  }
}
