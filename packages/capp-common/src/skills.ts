import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'

// Follows the host image plugin's shape (plan §1 host facts): one provider per
// plugin; each skill is a bundled candidate whose `get` returns the SKILL.md
// content with frontmatter stripped.

export interface SkillEntry {
  name: string
  description: string
}

export interface SkillProvider {
  name: string
}

interface SkillCandidate {
  name: string
  description: string
  invocation: { modelInvocable: boolean; userInvocable: boolean }
  provider: string
  source: 'bundled'
  rank: number
  locator: URL
  resourceBase: { kind: 'directory'; path: string }
}

interface SkillsContext {
  skills: {
    registerProvider(provider: () => { name: string; list: () => Promise<SkillCandidate[]>; get: (selected: SkillCandidate) => Promise<(SkillCandidate & { content: string }) | undefined> }): unknown
  }
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u

export function registerSkills(
  ctx: SkillsContext,
  provider: SkillProvider,
  dirUrl: string,
  skills: SkillEntry[],
): void {
  const base = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`
  const candidates: SkillCandidate[] = skills.map((s) => {
    const locator = new URL(`${s.name}/SKILL.md`, base)
    return {
      name: s.name,
      description: s.description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: provider.name,
      source: 'bundled',
      rank: BUNDLED_SKILL_RANK,
      locator,
      resourceBase: { kind: 'directory', path: fileURLToPath(new URL('.', locator)) },
    }
  })
  ctx.skills.registerProvider(() => ({
    name: provider.name,
    list: async () => candidates,
    get: async (selected) => {
      const hit = candidates.find((c) => c.name === selected.name)
      if (!hit) return undefined
      const content = (await readFile(hit.locator, 'utf8')).replace(FRONTMATTER, '').trim()
      return { ...hit, content }
    },
  }))
}
