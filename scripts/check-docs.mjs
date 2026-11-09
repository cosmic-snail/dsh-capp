// Mechanical documentation checks. Report only: never fixes files, renders HTML or fetches URLs.
// Zero dependencies on purpose, so the pre-commit hook works before `pnpm install` and
// against an exported index snapshot that has no node_modules. Rules: docs/development.md.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'lib', 'coverage', '.worktrees', 'capp-jobs'])
// Dated records; they keep their own history and don't count as current guides.
const ARCHIVE_DIRS = new Set(['acceptance', 'experiments', 'research'])
// Entry documents; every current guide under docs/ must be reachable from one of them.
const ENTRY_DOCS = ['README.md', 'AGENTS.md', 'docs/README.md']
const NOTE_STATES = new Set(['proposed', 'implemented', 'rejected'])
const NOTE_SECTIONS = ['Problem', 'Alternatives', 'Decision', 'Cost and limits', 'Evidence and gaps']

// Personal home directories, Windows user profiles and agent worktrees. `/Users/...` placeholders
// don't match because a real name must follow. Example asset dirs such as C:\capp-assets are fine.
const MACHINE_PATH = /(?:\/Users\/|\/home\/)[A-Za-z0-9._-]+\/|[A-Za-z]:\\Users\\[A-Za-z0-9._ -]+\\|\.codex\/worktrees|\.claude\/worktrees/g
// Private IPv4 ranges only (machine addresses stay out of a public repo, design §8).
const PRIVATE_IP = /(?<![\d.])(?:10(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}|192\.168(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){2})(?![\d.])/g
// Current pages describe the present; dated results belong in docs/acceptance or docs/experiments.
const DATED_PARAGRAPH = /^\s*(?:[-*]\s+)?20\d\d-\d\d-\d\d[\s:,.，：]/

export function listDocs (root) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (name.endsWith('.md')) out.push(relative(root, abs).split(sep).join('/'))
    }
  }
  walk(root)
  return out
}

export function isGuide (rel) {
  const parts = rel.split('/')
  return parts[0] === 'docs' && parts.length >= 2 && !ARCHIVE_DIRS.has(parts[1])
}

const isCurrent = (rel) => isGuide(rel) || rel === 'README.md' || rel === 'AGENTS.md'

// Removes fenced blocks and inline code so example links and paths inside code aren't checked
// as links. Line count is preserved for error positions.
export function stripCode (text) {
  const lines = text.split('\n')
  let fence = null
  return lines.map((line) => {
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null
      return ''
    }
    if (m) { fence = m[1]; return '' }
    return line.replace(/(`+)(?:(?!\1).)+?\1/g, '')
  })
}

// Inline links/images and reference definitions. Not a full CommonMark parser: links whose text
// contains nested brackets and HTML <a> tags are out of scope (docs/development.md).
export function linkDests (lines) {
  const out = []
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g)) out.push({ dest: m[1], line: i + 1 })
    const ref = line.match(/^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s|$)/)
    if (ref) out.push({ dest: ref[1], line: i + 1 })
  })
  return out
}

function localTarget (root, fromRel, dest) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(dest) && !/^[A-Za-z]:[\\/]/.test(dest)) return { external: true, scheme: dest.split(':')[0].toLowerCase() }
  if (dest.startsWith('#') || dest.startsWith('//')) return { external: true }
  const path = decodeURIComponent(dest.split('#')[0].split('?')[0])
  return { abs: resolve(root, dirname(fromRel), path) }
}

function checkNote (rel, text, lines, errors) {
  const parts = rel.split('/')
  if (parts.length !== 4 || !NOTE_STATES.has(parts[2])) {
    errors.push(`${rel}: notes live in .agents/notes/{proposed,implemented,rejected}/`)
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(parts[3])) errors.push(`${rel}: note file name must be YYYY-MM-DD-topic.md`)
  const statuses = [...text.matchAll(/^Status:\s*(\S+)\s*$/gm)].map((m) => m[1])
  if (statuses.length !== 1 || statuses[0] !== parts[2]) errors.push(`${rel}: "Status:" must appear once and equal ${parts[2]}`)
  for (const field of ['Date', 'Baseline']) {
    if (!new RegExp(`^${field}:\\s*\\S`, 'm').test(text)) errors.push(`${rel}: missing ${field}:`)
  }
  const headings = new Set(lines.filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()))
  for (const h of NOTE_SECTIONS) if (!headings.has(h)) errors.push(`${rel}: missing section "## ${h}"`)
}

function checkSkill (rel, text, errors) {
  const parts = rel.split('/')
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/)
  const name = fm?.[1].match(/^name:\s*(\S+)\s*$/m)?.[1]
  const description = fm?.[1].match(/^description:\s*\S/m)
  if (!fm || name !== parts[2] || !description) errors.push(`${rel}: frontmatter needs name: ${parts[2]} and a description`)
}

export function check (rootArg) {
  const root = resolve(rootArg)
  const errors = []
  const docs = listDocs(root)
  const links = new Map()

  for (const rel of docs) {
    const text = readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n')
    const raw = text.split('\n')
    const lines = stripCode(text)
    raw.forEach((line, i) => {
      const where = `${rel}:${i + 1}`
      for (const mp of line.matchAll(MACHINE_PATH)) errors.push(`${where}: machine-local path: ${mp[0]}`)
      for (const ip of line.matchAll(PRIVATE_IP)) errors.push(`${where}: private network address: ${ip[0]}`)
    })
    if (isCurrent(rel)) {
      lines.forEach((line, i) => {
        if (DATED_PARAGRAPH.test(line)) errors.push(`${rel}:${i + 1}: dated paragraph in a current page; put dated results in docs/acceptance/ or docs/experiments/`)
      })
    }
    const targets = []
    for (const { dest, line } of linkDests(lines)) {
      const t = localTarget(root, rel, dest)
      if (t.scheme === 'file' || /^[A-Za-z]:[\\/]/.test(dest)) {
        errors.push(`${rel}:${line}: machine-local link: ${dest}`)
        continue
      }
      if (t.external) continue
      if (t.abs !== root && !t.abs.startsWith(root + sep)) errors.push(`${rel}:${line}: link leaves the repository: ${dest}`)
      else if (!existsSync(t.abs)) errors.push(`${rel}:${line}: missing link target: ${dest}`)
      else if (t.abs.endsWith('.md')) targets.push(relative(root, t.abs).split(sep).join('/'))
    }
    links.set(rel, targets)
    if (rel.startsWith('.agents/notes/') && rel !== '.agents/notes/README.md') checkNote(rel, text, raw, errors)
    if (/^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(rel)) checkSkill(rel, text, errors)
  }

  // Reachability: archive pages are endpoints and don't pass reachability on.
  const seen = new Set()
  const queue = ENTRY_DOCS.filter((d) => links.has(d))
  while (queue.length) {
    const cur = queue.pop()
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const t of links.get(cur) ?? []) if ((isGuide(t) || ENTRY_DOCS.includes(t)) && !seen.has(t)) queue.push(t)
  }
  for (const rel of docs) {
    if (isGuide(rel) && !ENTRY_DOCS.includes(rel) && !seen.has(rel)) errors.push(`${rel}: not reachable from README.md, AGENTS.md or docs/README.md`)
  }
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--root')
  const root = i > 0 ? process.argv[i + 1] : resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const errors = check(root)
  if (errors.length) {
    console.error(errors.join('\n'))
    console.error(`docs: ${errors.length} problem(s)`)
    process.exit(1)
  }
  console.log('docs: links, paths, reachability, notes and skills passed')
}
