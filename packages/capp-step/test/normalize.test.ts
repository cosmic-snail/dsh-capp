import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalize } from '../src/normalize'

const FIXTURES = join(__dirname, '..', 'fixtures')
const nxReport = JSON.parse(readFileSync(join(FIXTURES, 'nx-report.synthetic.json'), 'utf8'))
const analysis = JSON.parse(readFileSync(join(FIXTURES, 'analysis.synthetic.json'), 'utf8'))

const SOURCE = { file: 'input/part.step', sha256: 'abc123' }
const REPORTS = [
  { name: 'nx/nx-report.json', json: nxReport },
  { name: 'nx/analysis.json', json: analysis },
]

describe('normalize', () => {
  it('maps known NX feature types to the open vocabulary', () => {
    const part = normalize(REPORTS, SOURCE)
    expect(part.schema).toBe('capp.part/v0')
    expect(part.units).toBe('mm')
    const types = part.features.map((f) => f.type)
    expect(types).toEqual(['cylinder_outer', 'cylinder_inner', 'plane_face', 'hole'])
    const outer = part.features[0]
    expect(outer?.params).toMatchObject({ diameter: 41.0, radius: 20.5, length: 5.0 })
    expect(outer?.nx_type).toBe('external_cylindrical_surface')
    expect(part.features.map((f) => f.id)).toEqual(['f1', 'f2', 'f3', 'f4'])
  })

  it('warns on unknown feature types instead of blocking', () => {
    const part = normalize(REPORTS, SOURCE)
    expect(part.warnings?.some((w) => w.includes('mystery_nx_type'))).toBe(true)
    expect(part.features).toHaveLength(4) // unknown skipped, 3 features + 1 group
  })

  it('sets material to null and warns when absent', () => {
    const part = normalize(REPORTS, SOURCE)
    expect(part.material).toBeNull()
    expect(part.warnings?.some((w) => w.includes('material'))).toBe(true)
  })

  it('takes bbox from body_bounds', () => {
    const part = normalize(REPORTS, SOURCE)
    expect(part.bbox?.min).toEqual([-5.0, -20.5, -20.5])
    expect(part.bbox?.max).toEqual([0.0, 20.5, 20.5])
  })

  it('lists both raw report paths', () => {
    const part = normalize(REPORTS, SOURCE)
    expect(part.raw).toEqual(['nx/nx-report.json', 'nx/analysis.json'])
  })

  it('survives missing reports with warnings and empty features', () => {
    const part = normalize([{ name: 'nx/empty.json', json: {} }], SOURCE)
    expect(part.features).toEqual([])
    expect(part.warnings?.length).toBeGreaterThanOrEqual(2)
    expect(part.bbox).toBeUndefined()
  })
})
