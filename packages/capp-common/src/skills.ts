// registerSkills follows the host image plugin's pattern: a provider builds
// SKILL.md content per skill name and the plugin registers them on the bus.
// The exact ctx.skills API is confirmed when the first skill ships (S3/S6);
// keep this thin so a host API change touches one file.

export interface SkillEntry {
  name: string
  description: string
}

export interface SkillProvider {
  skillDirUrl(name: string): string | undefined
}

interface SkillsContext {
  skills?: {
    register(entry: { name: string; description: string; source: string }): unknown
  }
  [key: string]: unknown
}

export function registerSkills(
  ctx: SkillsContext,
  provider: SkillProvider,
  dirUrl: string,
  skills: SkillEntry[],
): void {
  if (!ctx.skills?.register) return
  for (const s of skills) {
    const url = provider.skillDirUrl(s.name) ?? `${dirUrl.replace(/\/$/, '')}/${s.name}`
    ctx.skills.register({ name: s.name, description: s.description, source: url })
  }
}
