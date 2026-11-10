// types.ts — mirrors schemas/*.schema.json (design §6). Keep in sync by hand.

export interface SourceRef {
  file: string
  sha256: string
  [key: string]: unknown
}

export interface Feature {
  id: string
  type: string
  params?: Record<string, unknown>
  [key: string]: unknown
}

export interface Part {
  schema: 'capp.part/v0'
  source: SourceRef
  units: string
  bbox?: { min: number[]; max: number[]; [key: string]: unknown }
  features: Feature[]
  material?: unknown
  raw?: string[]
  warnings?: string[]
  [key: string]: unknown
}

export interface PlanOperation {
  id: string
  seq: number
  type: string
  name?: string
  features?: string[]
  tool?: { id?: string; desc?: string; [key: string]: unknown }
  params?: Record<string, unknown>
  cam?: { mcam_op?: number; [key: string]: unknown }
  [key: string]: unknown
}

export interface Plan {
  schema: 'capp.plan/v0'
  revision: number
  part: SourceRef
  mode: 'template' | 'freeform'
  template?: { id: string; version?: string; [key: string]: unknown }
  stock?: { material?: string; shape?: string; dims?: Record<string, unknown>; [key: string]: unknown }
  setups: Array<{ id: string; operations: PlanOperation[]; [key: string]: unknown }>
  notes?: string
  changes?: Array<{ revision?: number; by?: string; summary?: string; [key: string]: unknown }>
  [key: string]: unknown
}

export interface Approval {
  schema: 'capp.approval/v0'
  plan: { revision: number; sha256: string; [key: string]: unknown }
  approved_at: string
  note?: string
  [key: string]: unknown
}

export interface CamRequest {
  schema: 'capp.cam-request/v0'
  plan: { revision: number; sha256: string; [key: string]: unknown }
  template_mcam: string
  post: string
  operations: Array<{ mcam_op: number; params?: Record<string, unknown>; [key: string]: unknown }>
  steps: string[]
  simulate?: unknown
  [key: string]: unknown
}

export interface CamStatus {
  schema: 'capp.cam-status/v0'
  state: 'queued' | 'running' | 'succeeded' | 'failed'
  step?: string
  started_at?: string
  finished_at?: string | null
  nc?: string | null
  error?: { message?: string; log?: string; [key: string]: unknown } | null
  [key: string]: unknown
}

export interface NcReview {
  schema: 'capp.nc-review/v0'
  run: string
  nc_sha256: string
  decision: 'approved' | 'rejected'
  note?: string
  decided_at: string
  [key: string]: unknown
}

export type DocName = 'part' | 'plan' | 'approval' | 'cam-request' | 'cam-status' | 'nc-review'

export interface Docs {
  part: Part
  plan: Plan
  approval: Approval
  'cam-request': CamRequest
  'cam-status': CamStatus
  'nc-review': NcReview
}

export interface Issue {
  level: 'error' | 'warn'
  op_id?: string
  message: string
}
