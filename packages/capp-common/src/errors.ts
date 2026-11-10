export class CappError extends Error {
  readonly log?: string
  constructor(message: string, log?: string) {
    super(message)
    this.name = 'CappError'
    this.log = log
  }
}
