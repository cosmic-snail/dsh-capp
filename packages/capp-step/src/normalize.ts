import type { Feature, Part } from 'capp-common'

// normalize: map the NX extractor report + analyzer report to capp.part/v0.
// Pure function — everything that doesn't map becomes a warning, never a throw.

export interface ReportInput {
  name: string // e.g. 'nx/nx-report.json', 'nx/analysis.json'
  json: unknown
}

export interface NormalizeSource {
  file: string
  sha256: string
}

// NX analyzer feature types → open part vocabulary (design §6.1).
const TYPE_MAP: Record<string, string> = {
  external_cylindrical_surface: 'cylinder_outer',
  internal_cylindrical_bore_segment: 'cylinder_inner',
  positive_axis_end_face: 'plane_face',
  negative_axis_end_face: 'plane_face',
  stepped_through_bore: 'hole',
}

const PARAM_KEYS = ['diameter', 'length', 'radius'] as const

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function pickParams(f: Record<string, unknown>): Record<string, unknown> | undefined {
  const params: Record<string, unknown> = {}
  for (const k of PARAM_KEYS) {
    if (typeof f[k] === 'number') params[k] = f[k]
  }
  return Object.keys(params).length > 0 ? params : undefined
}

export function normalize(reports: ReportInput[], source: NormalizeSource): Part {
  const warnings: string[] = []
  const nxReport = reports.find((r) => r.name.includes('nx-report'))?.json
  const analysis = reports.find((r) => r.name.includes('analysis'))?.json
  if (!isObj(analysis)) warnings.push('analysis report missing or not an object; part has no features')
  if (!isObj(nxReport)) warnings.push('nx-report missing or not an object; material/units unknown')

  const analysisObj = isObj(analysis) ? analysis : {}
  const nxObj = isObj(nxReport) ? nxReport : {}

  // --- features ---
  const features: Feature[] = []
  const turning = isObj(analysisObj.manufacturing_model) && isObj(analysisObj.manufacturing_model.turning)
    ? analysisObj.manufacturing_model.turning
    : {}
  const rawFeatures = [...asArray(turning.features), ...asArray(turning.feature_groups)]
  for (const raw of rawFeatures) {
    if (!isObj(raw)) continue
    const nxType = typeof raw.type === 'string' ? raw.type : undefined
    const mapped = nxType ? TYPE_MAP[nxType] : undefined
    if (!nxType || !mapped) {
      warnings.push(`unmapped feature type ${nxType ?? '<none>'} skipped`)
      continue
    }
    const params = pickParams(raw)
    features.push({
      id: `f${features.length + 1}`,
      type: mapped,
      ...(params ? { params } : {}),
      nx_type: nxType,
      ...(typeof raw.feature_id === 'string' ? { nx_id: raw.feature_id } : {}),
    })
  }

  // --- bbox ---
  let bbox: Part['bbox']
  const cg = isObj(analysisObj.canonical_geometry) ? analysisObj.canonical_geometry : {}
  const bounds = asArray(cg.body_bounds).filter(isObj)
  if (bounds.length === 0) {
    warnings.push('no body_bounds in analysis report; bbox omitted')
  } else {
    if (bounds.length > 1) warnings.push(`${bounds.length} body bounds; using the first`)
    const b = bounds[0] as Record<string, unknown>
    const nums = (k: string) => (typeof b[k] === 'number' ? (b[k] as number) : undefined)
    const min = [nums('xmin'), nums('ymin'), nums('zmin')]
    const max = [nums('xmax'), nums('ymax'), nums('zmax')]
    if (min.every((v) => v !== undefined) && max.every((v) => v !== undefined)) {
      bbox = { min: min as number[], max: max as number[] }
    } else {
      warnings.push('body_bounds entries lack xmin/xmax/ymin/ymax/zmin/zmax; bbox omitted')
    }
  }

  // --- material ---
  const rpe = isObj(nxObj.raw_prt_extraction) ? nxObj.raw_prt_extraction : {}
  const me = isObj(rpe.material_evidence) ? rpe.material_evidence : {}
  const material = typeof me.material_name === 'string' && me.material_name ? me.material_name : null
  if (material === null) warnings.push('no material assigned in the source part')

  // --- units ---
  const ppa = isObj(nxObj.process_planning_agent_input) ? nxObj.process_planning_agent_input : {}
  const prt = isObj(ppa.prt_context) ? ppa.prt_context : {}
  const src = isObj(prt.source) ? prt.source : {}
  const unitsObj = isObj(src.units) ? src.units : {}
  const units = typeof unitsObj.length === 'string' && unitsObj.length ? unitsObj.length : 'mm'
  if (units === 'mm' && unitsObj.length === undefined) warnings.push('units not found in nx-report; assumed mm')

  return {
    schema: 'capp.part/v0',
    source: { file: source.file, sha256: source.sha256 },
    units,
    ...(bbox ? { bbox } : {}),
    features,
    material,
    raw: reports.map((r) => r.name),
    warnings,
  }
}
