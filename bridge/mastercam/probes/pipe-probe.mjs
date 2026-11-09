#!/usr/bin/env node
// pipe-probe.mjs — send a .csx script to Mastercam over its named pipe (S-MC spike).
// Usage: node pipe-probe.mjs <script.csx> [--set NAME=VALUE]...
// {{NAME}} placeholders in the script are replaced with --set values before RUN.
// Prints the greeting and the reply verbatim. Exit 0 iff the reply starts
// with "Ran Successfully.". No dependencies; Node >= 18.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import net from 'node:net'

const READ_TIMEOUT_MS = 30_000

function usage(msg) {
  if (msg) console.error(`pipe-probe: ${msg}`)
  console.error('usage: node pipe-probe.mjs <script.csx> [--set NAME=VALUE]...')
  process.exit(2)
}

const args = process.argv.slice(2)
const scriptPath = args.shift()
if (!scriptPath) usage('missing script path')
const sets = {}
for (let i = 0; i < args.length; i += 2) {
  if (args[i] !== '--set') usage(`unexpected argument ${args[i]}`)
  const eq = args[i + 1]?.indexOf('=') ?? -1
  if (eq < 1) usage('--set expects NAME=VALUE')
  sets[args[i + 1].slice(0, eq)] = args[i + 1].slice(eq + 1)
}

function findMastercamPid() {
  const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Mastercam.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' })
  const pids = out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('"Mastercam.exe"'))
    .map((line) => line.split('","')[1])
  if (pids.length !== 1) usage(`expected exactly one Mastercam.exe, found ${pids.length}`)
  return pids[0]
}

function render(source, values) {
  let text = source
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{{${name}}}`, value)
  }
  const left = text.match(/\{\{[A-Z_]+\}\}/g)
  if (left) usage(`unrendered placeholders: ${left.join(', ')}`)
  return text
}

function readUntil(socket, suffix) {
  return new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error(`read timeout waiting for "${suffix}"`)), READ_TIMEOUT_MS)
    socket.on('data', (chunk) => {
      text += chunk.toString('utf8')
      if (text.trimEnd().endsWith(suffix)) {
        clearTimeout(timer)
        resolve(text)
      }
    })
    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    socket.on('close', () => {
      clearTimeout(timer)
      reject(new Error(`pipe closed before "${suffix}"; got ${JSON.stringify(text.slice(-400))}`))
    })
  })
}

const pid = findMastercamPid()
const dir = mkdtempSync(join(tmpdir(), 'capp-mcam-'))
const rendered = join(dir, basename(scriptPath).replace(/\.csx$/i, '') + '.csx')
writeFileSync(rendered, render(readFileSync(scriptPath, 'utf8'), sets), 'utf8')
if (/\s/.test(rendered)) usage(`rendered path contains whitespace: ${rendered}`)

const socket = net.connect(`\\\\.\\pipe\\MastercamPipe${pid}`)
await new Promise((resolve, reject) => {
  socket.once('connect', resolve)
  socket.once('error', reject)
})

const greeting = await readUntil(socket, 'options.')
process.stdout.write(greeting)
const run = `RUN ${rendered}`
socket.write(run, 'utf8')
const reply = await readUntil(socket, 'Enter next command.')
process.stdout.write(reply)
socket.end()
process.exitCode = reply.trimStart().startsWith('Ran Successfully.') ? 0 : 1
