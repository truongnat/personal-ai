import { Injectable, Logger } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { randomBytes } from 'crypto'
import { Neo4jService } from '../neo4j/neo4j.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private neo4j: Neo4jService) {}

  async generateKey(label: string, expiresIn?: string): Promise<{ id: string; key: string; label: string; created_at: string }> {
    const rawKey = 'kb_live_' + randomBytes(16).toString('hex')
    const keyHash = await bcrypt.hash(rawKey, 10)
    const id = uuidv4()

    let expiresAt: string | null = null
    if (expiresIn) {
      const ms = this.parseDuration(expiresIn)
      expiresAt = new Date(Date.now() + ms).toISOString()
    }

    await this.neo4j.runQuery(
      `CREATE (k:ApiKey {
        id: $id,
        key_hash: $keyHash,
        label: $label,
        active: true,
        expires_at: $expiresAt,
        created_at: $createdAt,
        last_used_at: null,
        use_count: 0
      })`,
      { id, keyHash, label, expiresAt, createdAt: new Date().toISOString() },
    )

    this.logger.log(`API key generated: ${label} (${id})`)
    return { id, key: rawKey, label, created_at: new Date().toISOString() }
  }

  async validateKey(rawKey: string): Promise<boolean> {
    const result = await this.neo4j.runQuery(
      `MATCH (k:ApiKey { active: true })
       WHERE k.expires_at IS NULL OR k.expires_at > $now
       RETURN k.id AS id, k.key_hash AS hash`,
      { now: new Date().toISOString() },
    )

    for (const record of result.records) {
      const hash = record.get('hash')
      const id = record.get('id')
      const match = await bcrypt.compare(rawKey, hash)
      if (match) {
        await this.neo4j.runQuery(
          `MATCH (k:ApiKey { id: $id })
           SET k.last_used_at = $now, k.use_count = k.use_count + 1`,
          { id, now: new Date().toISOString() },
        )
        return true
      }
    }
    return false
  }

  async revokeKey(id: string): Promise<void> {
    await this.neo4j.runQuery(
      `MATCH (k:ApiKey { id: $id }) SET k.active = false`,
      { id },
    )
  }

  async listKeys(): Promise<any[]> {
    const result = await this.neo4j.runQuery(
      `MATCH (k:ApiKey) RETURN k ORDER BY k.created_at DESC`,
    )
    return result.records.map((r) => {
      const k = r.get('k').properties
      return {
        id: k.id,
        label: k.label,
        key_masked: 'kb_live_xxxx...xxxx',
        active: k.active,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        use_count: typeof k.use_count === 'object' ? k.use_count.toNumber() : k.use_count,
      }
    })
  }

  private parseDuration(d: string): number {
    const map: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 }
    const match = d.match(/^(\d+)([dhms])$/)
    if (!match) return 0
    return parseInt(match[1]) * (map[match[2]] ?? 0)
  }
}
