import { Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import neo4j from 'neo4j-driver'
import { Neo4jService } from '../neo4j/neo4j.service'
import { CacheService } from '../cache/cache.service'
import { SearchService } from '../search/search.service'
import { PushKbDto } from './dto/push-kb.dto'
import { UpdateKbDto } from './dto/update-kb.dto'

@Injectable()
export class KbService {
  constructor(
    private neo4j: Neo4jService,
    private cache: CacheService,
    private searchSvc: SearchService,
  ) {}

  async push(dto: PushKbDto): Promise<{ id: string; message: string; related_found: number }> {
    const id = uuidv4()
    const now = new Date().toISOString()
    const summary = dto.content.replace(/#+\s/g, '').slice(0, 200)
    const tags = dto.tags ?? []
    const technologies = dto.technologies ?? []

    await this.neo4j.runQuery(
      `CREATE (s:Solution {
        id: $id,
        title: $title,
        content: $content,
        summary: $summary,
        ticket_ref: $ticketRef,
        project: $project,
        created_at: $now,
        updated_at: $now
      })`,
      { id, title: dto.title, content: dto.content, summary, ticketRef: dto.ticket_ref ?? null, project: dto.project ?? null, now },
    )

    for (const tag of tags) {
      await this.neo4j.runQuery(
        `MERGE (t:Tag { name: $tag })
         WITH t
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:TAGGED_WITH]->(t)`,
        { tag, id },
      )
    }

    if (dto.project) {
      await this.neo4j.runQuery(
        `MERGE (p:Project { name: $project })
         WITH p
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:BELONGS_TO]->(p)`,
        { project: dto.project, id },
      )
    }

    for (const tech of technologies) {
      await this.neo4j.runQuery(
        `MERGE (t:Technology { name: $tech })
         WITH t
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:USES]->(t)`,
        { tech, id },
      )
    }

    let relatedFound = 0
    if (tags.length > 0) {
      const related = await this.neo4j.runQuery(
        `MATCH (existing:Solution)-[:TAGGED_WITH]->(t:Tag)
         WHERE t.name IN $tags AND existing.id <> $id
         WITH DISTINCT existing
         MATCH (s:Solution { id: $id })
         MERGE (s)-[:RELATED_TO]->(existing)
         RETURN count(existing) AS cnt`,
        { tags, id },
      )
      relatedFound = related.records[0]?.get('cnt')?.toNumber() ?? 0
    }

    await this.searchSvc.indexDocument('solutions', {
      id,
      title: dto.title,
      content: dto.content,
      tags,
      project: dto.project ?? null,
      technologies,
      created_at: now,
    })

    await this.cache.delByPattern('search:*')

    return { id, message: 'Pushed successfully', related_found: relatedFound }
  }

  async search(query: string, limit = 5): Promise<{ results: any[]; total: number; cached: boolean }> {
    const cacheKey = 'search:' + createHash('md5').update(query + limit).digest('hex')
    const cached = await this.cache.get<any>(cacheKey)
    if (cached) return { ...cached, cached: true }

    const { hits, totalHits } = await this.searchSvc.search('solutions', query, { limit })

    const results: any[] = []
    for (const hit of hits) {
      const res = await this.neo4j.runQuery(
        `MATCH (s:Solution { id: $id })
         OPTIONAL MATCH (s)-[:RELATED_TO]->(rel:Solution)
         RETURN s, collect({ id: rel.id, title: rel.title }) AS related`,
        { id: hit.id },
      )
      if (res.records.length === 0) continue
      const rec = res.records[0]
      const s = rec.get('s').properties
      const related = (rec.get('related') as any[]).filter((r) => r.id)
      results.push({
        id: s.id,
        title: s.title,
        summary: s.summary,
        tags: hit.tags,
        ticket_ref: s.ticket_ref,
        project: s.project,
        score: hit._rankingScore ?? 0,
        related,
        created_at: s.created_at,
      })
    }

    const payload = { results, total: totalHits }
    await this.cache.set(cacheKey, payload, 300)
    return { ...payload, cached: false }
  }

  async list(opts: { tag?: string; project?: string; page?: number; limit?: number }) {
    const page = opts.page ?? 1
    const limit = opts.limit ?? 20
    const skip = neo4j.int((page - 1) * limit)

    let cypher = `MATCH (s:Solution)`
    const params: any = { skip, limit: neo4j.int(limit) }

    if (opts.tag) {
      cypher = `MATCH (s:Solution)-[:TAGGED_WITH]->(t:Tag { name: $tag })`
      params.tag = opts.tag
    } else if (opts.project) {
      cypher = `MATCH (s:Solution)-[:BELONGS_TO]->(p:Project { name: $project })`
      params.project = opts.project
    }

    const countRes = await this.neo4j.runQuery(cypher + ' RETURN count(s) AS cnt', params)
    const total = countRes.records[0]?.get('cnt')?.toNumber() ?? 0

    const result = await this.neo4j.runQuery(
      cypher + ' RETURN s ORDER BY s.created_at DESC SKIP $skip LIMIT $limit',
      params,
    )

    const items = result.records.map((r) => {
      const s = r.get('s').properties
      return { id: s.id, title: s.title, summary: s.summary, ticket_ref: s.ticket_ref, project: s.project, created_at: s.created_at }
    })

    return { items, total, page, limit }
  }

  async getById(id: string) {
    const result = await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id })
       OPTIONAL MATCH (s)-[:TAGGED_WITH]->(t:Tag)
       OPTIONAL MATCH (s)-[:RELATED_TO]->(rel:Solution)
       RETURN s,
         collect(DISTINCT t.name) AS tags,
         collect(DISTINCT { id: rel.id, title: rel.title }) AS related`,
      { id },
    )
    if (result.records.length === 0) throw new NotFoundException(`Solution ${id} not found`)

    const rec = result.records[0]
    const s = rec.get('s').properties
    return {
      id: s.id,
      title: s.title,
      content: s.content,
      tags: rec.get('tags'),
      ticket_ref: s.ticket_ref,
      project: s.project,
      technologies: [],
      created_at: s.created_at,
      updated_at: s.updated_at,
      related: (rec.get('related') as any[]).filter((r) => r.id),
    }
  }

  async update(id: string, dto: UpdateKbDto) {
    const existing = await this.getById(id)
    const now = new Date().toISOString()

    await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id })
       SET s.title = $title,
           s.content = $content,
           s.summary = $summary,
           s.ticket_ref = $ticketRef,
           s.project = $project,
           s.updated_at = $now`,
      {
        id,
        title: dto.title ?? existing.title,
        content: dto.content ?? existing.content,
        summary: (dto.content ?? existing.content).replace(/#+\s/g, '').slice(0, 200),
        ticketRef: dto.ticket_ref ?? existing.ticket_ref,
        project: dto.project ?? existing.project,
        now,
      },
    )

    await this.searchSvc.updateDocument('solutions', {
      id,
      title: dto.title ?? existing.title,
      content: dto.content ?? existing.content,
      tags: dto.tags ?? existing.tags,
      project: dto.project ?? existing.project,
    })

    await this.cache.delByPattern('search:*')
    return { id, message: 'Updated successfully' }
  }

  async delete(id: string) {
    await this.neo4j.runQuery(
      `MATCH (s:Solution { id: $id }) DETACH DELETE s`,
      { id },
    )
    await this.searchSvc.deleteDocument('solutions', id)
    await this.cache.delByPattern('search:*')
    return { message: 'Deleted successfully' }
  }
}
