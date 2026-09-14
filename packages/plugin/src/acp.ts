import type { AcpBackend, AcpInitializeParams, AcpInitializeResult, AcpPromptParams, AcpSessionParams, AcpPermissionResponseParams, AcpCancelParams, AcpSetModeParams, AcpSessionUpdate } from '@dsh-remote/protocol'

/** Backend-neutral ACP adapter. Implementations must keep state scoped to a connection. */
export interface AcpBackendAdapter {
  readonly backend: AcpBackend
  initialize(params: AcpInitializeParams): Promise<AcpInitializeResult>
  sessionNew(params: AcpSessionParams): Promise<{ sessionId: string }>
  sessionLoad?(params: AcpSessionParams): Promise<{ sessionId: string }>
  prompt(params: AcpPromptParams, emit: (update: AcpSessionUpdate) => Promise<void>): Promise<void>
  respondPermission?(params: AcpPermissionResponseParams): Promise<void>
  cancel?(params: AcpCancelParams): Promise<void>
  setMode?(params: AcpSetModeParams): Promise<void>
  close?(): Promise<void>
}

export class AcpGateway {
  constructor(private readonly adapter: AcpBackendAdapter) {}
  initialize(p: AcpInitializeParams) { return this.adapter.initialize(p) }
  sessionNew(p: AcpSessionParams) { return this.adapter.sessionNew(p) }
  sessionLoad(p: AcpSessionParams) { if (!this.adapter.sessionLoad) throw new Error('CAPABILITY_NOT_SUPPORTED'); return this.adapter.sessionLoad(p) }
  prompt(p: AcpPromptParams, emit: (u: AcpSessionUpdate) => Promise<void>) { return this.adapter.prompt(p, emit) }
  respondPermission(p: AcpPermissionResponseParams) { if (!this.adapter.respondPermission) throw new Error('CAPABILITY_NOT_SUPPORTED'); return this.adapter.respondPermission(p) }
  cancel(p: AcpCancelParams) { if (!this.adapter.cancel) throw new Error('CAPABILITY_NOT_SUPPORTED'); return this.adapter.cancel(p) }
  setMode(p: AcpSetModeParams) { if (!this.adapter.setMode) throw new Error('CAPABILITY_NOT_SUPPORTED'); return this.adapter.setMode(p) }
}

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'

export interface AcpIdeConfig { id: 'codex' | 'cursor' | 'kimi' | 'zcode'; command: string; args?: string[]; cwd?: string }
export const DEFAULT_ACP_IDES: readonly AcpIdeConfig[] = [
  { id: 'codex', command: 'codex', args: ['acp'] },
  { id: 'cursor', command: 'agent', args: ['acp'] },
  { id: 'kimi', command: 'kimi', args: ['acp'] },
  { id: 'zcode', command: 'zcode', args: ['acp'] },
]

/** JSON-RPC stdio bridge for ACP agents (Cursor/Kimi/CodeX). */
export class StdioAcpAdapter {
  readonly backend: AcpBackend
  private child?: ChildProcessWithoutNullStreams
  private nextId = 1
  constructor(private readonly config: AcpIdeConfig) { this.backend = config.id }
  private ensure() { if (!this.child) this.child = spawn(this.config.command, this.config.args ?? [], { cwd: this.config.cwd, stdio: 'pipe' }); return this.child }
  async initialize(params: AcpInitializeParams): Promise<AcpInitializeResult> { await this.call('initialize', params); return { protocolVersion: 1, capability: 'agent.acp.v1', backend: this.backend, capabilities: ['session.new','session.load','session.prompt','session.cancel'] } }
  async sessionNew(params: AcpSessionParams) { const r = await this.call('session/new', params) as { sessionId?: string }; if (!r.sessionId) throw new Error('INVALID_MESSAGE'); return { sessionId: r.sessionId } }
  async sessionLoad(params: AcpSessionParams) { const r = await this.call('session/load', params) as { sessionId?: string }; if (!r.sessionId) throw new Error('INVALID_MESSAGE'); return { sessionId: r.sessionId } }
  async prompt(params: AcpPromptParams, emit: (u: AcpSessionUpdate) => Promise<void>) { await this.call('session/prompt', params, async n => emit({ sessionId: params.sessionId, update: n, seq: this.nextId++ })) }
  async cancel(p: AcpCancelParams) { await this.call('session/cancel', p) }
  async setMode(p: AcpSetModeParams) { await this.call('session/set_mode', p) }
  async respondPermission(p: AcpPermissionResponseParams) { await this.call('session/request_permission', p) }
  async close() { this.child?.kill(); this.child = undefined }
  private call(method: string, params: unknown, onNotification?: (n: unknown) => Promise<void>): Promise<unknown> { const c = this.ensure(); const id = this.nextId++; c.stdin.write(JSON.stringify({ jsonrpc:'2.0', id, method, params })+'\n'); return new Promise((resolve,reject)=>{ let buf=''; const onData=async (d: Buffer)=>{ buf+=d; const lines=buf.split('\n'); buf=lines.pop()??''; for(const l of lines){ try { const m=JSON.parse(l); if(m.id===id) { c.stdout.off('data',onData); m.error?reject(new Error(m.error.message??'ACP error')):resolve(m.result) } else if(m.method&&onNotification) await onNotification(m.params) } catch {} } }; c.stdout.on('data',onData); c.once('error',reject) }) }
}
