import { RemoteTypertGateway, type RemoteGatewayStream } from '@dsh-remote/client-core'
import type { PermissionSelect } from '../types'

export interface WorkspaceDirectory {
  path: string
  entries: Array<{ name: string; type: 'file' | 'directory' | 'other'; size?: number }>
  truncated: boolean
}
export interface WorkspaceText {
  absolutePath: string
  version: string
  text: string
  offset: number
  lines: number
  eof: boolean
}
export interface TerminalInfo {
  id: string
  title: string
  state: 'running' | 'exited' | 'failed'
  controllerId?: string
  cols: number
  rows: number
  exitCode: number | null
}
export type TerminalFrame =
  | { type: 'snapshot'; sequence: number; screen: string; info: TerminalInfo }
  | { type: 'output'; sequence: number; data: string }
  | { type: 'state'; info: TerminalInfo }

/** Official Typert endpoints only; Host owns scope, device ownership and input authorization. */
export class HarnessSessionTools {
  constructor(private readonly gateway: RemoteTypertGateway) {}

  async permissionOptions(signal?: AbortSignal): Promise<PermissionSelect['options']> {
    const value = await this.gateway.call<{ options: PermissionSelect['options'] }>('permissionPresets/catalog', { args: {} }, signal)
    if (!Array.isArray(value?.options) || value.options.some(option => typeof option?.value !== 'string' || typeof option.name !== 'string')) {
      throw Object.assign(new Error('Invalid permission catalog'), { code: 'INVALID_MESSAGE' })
    }
    return value.options.map(option => ({ value: option.value, name: option.name, ...(typeof option.description === 'string' ? { description: option.description } : {}) }))
  }

  listFiles(sessionId: string, path: string, signal?: AbortSignal): Promise<WorkspaceDirectory> {
    return this.gateway.call('workspaceFiles/list', { args: { workspaceFileScopeId: sessionId, path } }, signal)
  }

  readFile(sessionId: string, path: string, offset = 1, signal?: AbortSignal): Promise<WorkspaceText> {
    return this.gateway.call('workspaceFiles/read', { args: { workspaceFileScopeId: sessionId, path, range: { offset, limit: 200 } } }, signal)
  }

  terminalEnvironment(sessionId: string): Promise<{ maxInputBytes: number; maxCols: number; maxRows: number }> {
    return this.gateway.call('terminal/environment', { args: { agentId: sessionId } })
  }

  listTerminals(sessionId: string): Promise<TerminalInfo[]> {
    return this.gateway.call('terminal/list', { args: { sessionId } })
  }

  createTerminal(sessionId: string, id: string, cols: number, rows: number): Promise<TerminalInfo> {
    return this.gateway.call('terminal/create', { args: { agentId: sessionId, request: { id, cols, rows } } })
  }

  retainTerminal(sessionId: string, id: string, signal: AbortSignal): Promise<RemoteGatewayStream> {
    return this.gateway.open('terminal/retain', { args: { sessionId, id } }, signal)
  }

  followTerminal(sessionId: string, id: string, attachmentId: string, signal: AbortSignal): Promise<RemoteGatewayStream> {
    return this.gateway.open('terminal/follow', { args: { agentId: sessionId, id, attachmentId } }, signal)
  }

  writeTerminal(sessionId: string, id: string, attachmentId: string, data: string): Promise<void> {
    // Never retry: after a timeout, it is unknown whether the shell consumed the input.
    return this.gateway.call('terminal/write', { args: { agentId: sessionId, id, attachmentId, data } })
  }

  resizeTerminal(sessionId: string, id: string, attachmentId: string, cols: number, rows: number): Promise<void> {
    return this.gateway.call('terminal/resize', { args: { agentId: sessionId, id, attachmentId, cols, rows } })
  }

  closeTerminal(sessionId: string, id: string): Promise<void> {
    return this.gateway.call('terminal/close', { args: { agentId: sessionId, id } })
  }
}
