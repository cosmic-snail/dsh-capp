import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'
import type { SkillCandidate, SkillDefinition, SkillProvider } from '@deepseek-ai/dsh-skill'

// Follows the host image plugin's shape (plan §1 host facts): one provider per
// plugin; each skill is a bundled candidate whose `get` returns the SKILL.md
// content with frontmatter stripped. Types come from @deepseek-ai/dsh-skill.

export interface SkillEntry {
  name: string
  description: string
}

export interface SkillProviderInfo {
  name: string
}

export interface SkillsContext {
  skills: {
    registerProvider(create: (control: unknown) => SkillProvider): unknown
  }
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/u

export function registerSkills(
  ctx: SkillsContext,
  provider: SkillProviderInfo,
  dirUrl: string,
  skills: SkillEntry[],
): void {
  const base = dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`
  const candidates: Array<SkillCandidate & { locator: URL }> = skills.map((s) => {
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
  const skillProvider: SkillProvider = {
    name: provider.name,
    list: async () => candidates,
    get: async (selected: SkillCandidate): Promise<SkillDefinition | undefined> => {
      const hit = candidates.find((c) => c.name === selected.name)
      if (!hit) return undefined
      const content = (await readFile(hit.locator, 'utf8')).replace(FRONTMATTER, '').trim()
      return { ...hit, content }
    },
  }
  ctx.skills.registerProvider(() => skillProvider)
}
