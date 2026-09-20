import { strings } from '../locales/i18n'

export function sessionToolsError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
  if (code === 'TERMINAL_DISABLED') return strings.tools.terminalDisabled
  if (code === 'PERMISSION_DENIED' || code === 'terminal/control-unavailable') return strings.tools.controlDenied
  if (code === 'FEATURE_NOT_SUPPORTED' || code === 'METHOD_NOT_ALLOWED' || code === 'METHOD_NOT_FOUND'
    || code === 'not-found' || code === 'unknown-endpoint'
    || code === 'gateway/service-unavailable' || code === 'gateway/method-unavailable'
    || code === 'gateway/definition-unavailable' || code === 'gateway/invocation-unavailable') return strings.tools.unsupported
  if (code === 'workspace-file/not-text') return strings.tools.notText
  if (code === 'workspace-file/too-large') return strings.tools.tooLarge
  return strings.tools.failed
}
