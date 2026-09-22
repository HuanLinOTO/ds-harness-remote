import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { realpath, lstat, readdir, readFile, stat, watch } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { RpcError } from './safe-error.js'
import { parseCodexSessionId } from './codex/session-id.js'
import type { TypertRpcResult } from './typert-gateway-contract.js'

const MAX_READ_BYTES = 4 * 1024 * 1024
const MAX_INPUT_BYTES = 64 * 1024
const MAX_COLS = 240
const MAX_ROWS = 100
const MAX_TERMINALS = 256

export class CodexWorkspaceState {
  readonly terminals = new Map<string, TerminalContext>()
}

export type CodexCwdResolver = (threadId: string, signal: AbortSignal) => Promise<string | undefined>

interface TerminalContext {
  sessionId: string
  id: string
  title: string
  cwd: string
  cols: number
  rows: number
  process: ChildProcessWithoutNullStreams
  sequence: number
  subscribers: Set<AsyncQueue<unknown>>
  history: unknown[]
  state: 'running' | 'exited' | 'failed'
  exitCode: number | null
}

class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private waiters: Array<(value: IteratorResult<T>) => void> = []
  private ended = false
  push(value: T): void {
    if (this.ended) return
    const waiter = this.waiters.shift()
    if (waiter) waiter({ done: false, value })
    else this.values.push(value)
  }
  end(): void {
    this.ended = true
    while (this.waiters.length) this.waiters.shift()!({ done: true, value: undefined as never })
  }
  next(): Promise<IteratorResult<T>> {
    const value = this.values.shift()
    if (value !== undefined) return Promise.resolve({ done: false, value })
    if (this.ended) return Promise.resolve({ done: true, value: undefined as never })
    return new Promise(resolve => this.waiters.push(resolve))
  }
  [Symbol.asyncIterator](): AsyncIterator<T> { return this }
}

/** Host-owned CodeX file and terminal carrier used by Harness Remote RPC. */
export class CodexWorkspaceBridge {
  private readonly terminals: Map<string, TerminalContext>
  private readonly ownedSubscribers = new Set<AsyncQueue<unknown>>()

  constructor(private readonly resolveCwd: CodexCwdResolver, private readonly terminalEnabled: () => boolean, state = new CodexWorkspaceState()) {
    this.terminals = state.terminals
  }

  isCodeXScope(value: unknown): boolean {
    return parseCodexSessionId(value) !== undefined
  }

  async call(endpoint: string, payload: unknown, signal: AbortSignal): Promise<TypertRpcResult | undefined> {
    const args = argsOf(payload)
    const scope = args.workspaceFileScopeId
    const session = args.agentId ?? args.sessionId
    const raw = scope ?? session
    const codex = parseCodexSessionId(raw)
    if (codex === undefined) { if (typeof raw === 'string' && raw.startsWith('codex:')) throw new RpcError('CODEX_SESSION_INVALID', 'The CodeX session identifier is invalid.'); return undefined }
    if (endpoint.startsWith('workspaceFiles/')) return this.fileCall(endpoint, codex.sessionId, args, signal)
    if (endpoint.startsWith('terminal/')) return this.terminalCall(endpoint, codex.sessionId, args, signal)
    return undefined
  }

  async open(endpoint: string, payload: unknown, signal: AbortSignal): Promise<AsyncIterable<unknown> | undefined> {
    const args = argsOf(payload)
    const raw = args.workspaceFileScopeId ?? args.agentId ?? args.sessionId
    const codex = parseCodexSessionId(raw)
    if (codex === undefined) { if (typeof raw === 'string' && raw.startsWith('codex:')) throw new RpcError('CODEX_SESSION_INVALID', 'The CodeX session identifier is invalid.'); return undefined }
    if (endpoint === 'workspaceFiles/changes') return this.watchChanges(codex.sessionId, args, signal)
    if (endpoint === 'terminal/follow' || endpoint === 'terminal/retain') {
      this.assertTerminalEnabled()
      await this.rootFor(codex.sessionId, signal)
      const terminal = await this.requireTerminal(codex.sessionId, String(args.id), signal)
      if (endpoint === 'terminal/follow') {
        if (typeof args.attachmentId !== 'string' || args.attachmentId.length < 1) throw new RpcError('INVALID_MESSAGE', 'The terminal attachment is invalid.')
      }
      const queue = new AsyncQueue<unknown>()
      terminal.subscribers.add(queue)
      this.ownedSubscribers.add(queue)
      if (endpoint === 'terminal/retain') for (const item of terminal.history) queue.push(item)
      signal.addEventListener('abort', () => { terminal.subscribers.delete(queue); this.ownedSubscribers.delete(queue); queue.end() }, { once: true })
      return queue
    }
    return undefined
  }

  async closeAll(): Promise<void> {
    // A transport disconnect closes subscriptions but retains Host-owned terminal
    // processes so a reconnect can use terminal/retain, matching Harness policy.
    for (const queue of this.ownedSubscribers) queue.end()
    this.ownedSubscribers.clear()
  }

  private async fileCall(endpoint: string, sessionId: string, args: Record<string, unknown>, signal: AbortSignal): Promise<TypertRpcResult> {
    const root = await this.rootFor(sessionId, signal)
    const path = typeof args.path === 'string' ? args.path : '.'
    const target = await this.safePath(root, path, endpoint === 'workspaceFiles/list')
    try {
      if (endpoint === 'workspaceFiles/list') {
        const entries = await readdir(target, { withFileTypes: true })
        const result = []
        for (const entry of entries.slice(0, 500)) {
          const item = join(target, entry.name)
          const info = await lstat(item)
          if (info.isSymbolicLink()) continue
          result.push({ name: entry.name, type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', ...(info.isFile() ? { size: info.size } : {}) })
        }
        return { ok: true, value: { path, entries: result, truncated: entries.length > 500 } }
      }
      const info = await stat(target)
      if (endpoint === 'workspaceFiles/stat') return { ok: true, value: { path, type: info.isDirectory() ? 'directory' : info.isFile() ? 'file' : 'other', size: info.size, modifiedAt: info.mtimeMs } }
      if (!info.isFile()) throw new RpcError('CODEX_WORKSPACE_INVALID_PATH', 'The requested workspace path is not a file.')
      const offset = readOffset(args)
      const limit = readLimit(args)
      const bytes = await readFile(target)
      if (bytes.byteLength > MAX_READ_BYTES) throw new RpcError('CODEX_WORKSPACE_TOO_LARGE', 'The requested workspace file is too large.')
      if (endpoint === 'workspaceFiles/readBytes') {
        const slice = bytes.subarray(offset, Math.min(offset + limit, bytes.length))
        return { ok: true, value: { path, offset, bytes: slice.toString('base64'), eof: offset + slice.length >= bytes.length } }
      }
      const text = bytes.toString('utf8')
      const slice = text.slice(offset, offset + limit)
      return { ok: true, value: { absolutePath: target, version: `${info.mtimeMs}:${info.size}`, text: slice, offset, lines: slice.split('\n').length, eof: offset + slice.length >= text.length } }
    } catch (error) {
      if (error instanceof RpcError) throw error
      throw new RpcError('CODEX_WORKSPACE_UNAVAILABLE', 'The CodeX workspace file is unavailable.')
    }
  }

  private async watchChanges(sessionId: string, args: Record<string, unknown>, signal: AbortSignal): Promise<AsyncIterable<unknown>> {
    const root = await this.rootFor(sessionId, signal)
    const target = await this.safePath(root, typeof args.path === 'string' ? args.path : '.', true)
    const queue = new AsyncQueue<unknown>()
    const watcher = watch(target, { recursive: false })
    const abort = () => { watcher.return?.(); queue.end() }
    signal.addEventListener('abort', abort, { once: true })
    void (async () => {
      try { for await (const event of watcher) queue.push({ type: event.eventType, path: event.filename ?? '' }) }
      catch { /* stream close is reported by the gateway */ }
      finally { signal.removeEventListener('abort', abort); queue.end() }
    })()
    return queue
  }

  private async terminalCall(endpoint: string, sessionId: string, args: Record<string, unknown>, signal: AbortSignal): Promise<TypertRpcResult> {
    this.assertTerminalEnabled()
    const cwd = await this.rootFor(sessionId, signal)
    if (endpoint === 'terminal/environment') return { ok: true, value: { cwd, maxInputBytes: MAX_INPUT_BYTES, maxCols: MAX_COLS, maxRows: MAX_ROWS } }
    if (endpoint === 'terminal/shells') return { ok: true, value: [{ id: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh', name: process.platform === 'win32' ? 'Command Prompt' : 'sh' }] }
    if (endpoint === 'terminal/list') return { ok: true, value: [...this.terminals.values()].filter(item => item.sessionId === sessionId).map(terminalInfo) }
    if (endpoint === 'terminal/create') {
      const request = isRecord(args.request) ? args.request : {}
      const id = stringId(request.id)
      if ([...this.terminals.values()].some(item => item.sessionId === sessionId && item.id === id)) throw new RpcError('REQUEST_CONFLICT', 'The terminal id is already active.')
      if (this.terminals.size >= MAX_TERMINALS) throw new RpcError('RATE_LIMITED', 'Too many remote terminals are active.', undefined, true)
      const cols = bounded(request.cols, 80, MAX_COLS); const rows = bounded(request.rows, 24, MAX_ROWS)
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
      const child = spawn(shell, [], { cwd, stdio: 'pipe', windowsHide: true })
      const terminal: TerminalContext = { sessionId, id, title: typeof request.title === 'string' ? request.title : id, cwd, cols, rows, process: child, sequence: 0, subscribers: new Set(), history: [], state: 'running', exitCode: null }
      this.terminals.set(`${sessionId}/${id}`, terminal)
      child.stdout.on('data', data => this.emit(terminal, { type: 'output', sequence: ++terminal.sequence, data: Buffer.from(data).toString('utf8') }))
      child.stderr.on('data', data => this.emit(terminal, { type: 'output', sequence: ++terminal.sequence, data: Buffer.from(data).toString('utf8') }))
      child.on('error', () => { terminal.state = 'failed'; this.emit(terminal, { type: 'state', info: terminalInfo(terminal) }); this.endSubscribers(terminal) })
      child.on('exit', code => { terminal.state = 'exited'; terminal.exitCode = code; this.emit(terminal, { type: 'state', info: terminalInfo(terminal) }); this.endSubscribers(terminal) })
      return { ok: true, value: terminalInfo(terminal) }
    }
    const id = stringId(args.id)
    const terminal = await this.requireTerminal(sessionId, id, signal)
    if (endpoint === 'terminal/write') {
      const data = typeof args.data === 'string' ? args.data : ''
      if (Buffer.byteLength(data) > MAX_INPUT_BYTES) throw new RpcError('INVALID_MESSAGE', 'Terminal input is too large.')
      terminal.process.stdin.write(data)
      return { ok: true, value: {} }
    }
    if (endpoint === 'terminal/resize') { terminal.cols = bounded(args.cols, terminal.cols, MAX_COLS); terminal.rows = bounded(args.rows, terminal.rows, MAX_ROWS); return { ok: true, value: terminalInfo(terminal) } }
    if (endpoint === 'terminal/rename') { terminal.title = typeof args.title === 'string' && args.title.length > 0 ? args.title.slice(0, 128) : terminal.title; return { ok: true, value: terminalInfo(terminal) } }
    if (endpoint === 'terminal/close') { this.disposeTerminal(terminal); this.terminals.delete(`${sessionId}/${id}`); return { ok: true, value: {} } }
    throw new RpcError('METHOD_NOT_FOUND', 'The requested terminal method does not exist.')
  }

  private async rootFor(sessionId: string, signal: AbortSignal): Promise<string> {
    const parsed = parseCodexSessionId(sessionId)
    if (!parsed) throw new RpcError('CODEX_SESSION_INVALID', 'The CodeX session identifier is invalid.')
    const cwd = await this.resolveCwd(parsed.threadId, signal)
    if (!cwd) throw new RpcError('CODEX_WORKSPACE_UNAVAILABLE', 'The CodeX thread has no available workspace.')
    try { const root = await realpath(cwd); const info = await stat(root); if (!info.isDirectory()) throw new Error(); return root }
    catch { throw new RpcError('CODEX_WORKSPACE_UNAVAILABLE', 'The CodeX workspace is unavailable.') }
  }

  private async safePath(root: string, path: string, directory: boolean): Promise<string> {
    if (isAbsolute(path)) throw new RpcError('CODEX_WORKSPACE_PATH_DENIED', 'The requested workspace path is outside the CodeX workspace.')
    const candidate = resolve(root, path)
    const rel = relative(root, candidate)
    if (rel.startsWith('..') || isAbsolute(rel)) throw new RpcError('CODEX_WORKSPACE_PATH_DENIED', 'The requested workspace path is outside the CodeX workspace.')
    try {
      const info = await lstat(candidate)
      if (info.isSymbolicLink()) throw new Error()
      const canonical = await realpath(candidate)
      const canonicalRel = relative(root, canonical)
      if (canonicalRel.startsWith('..') || isAbsolute(canonicalRel)) throw new Error()
      if (directory && !info.isDirectory()) throw new Error()
      return canonical
    } catch { throw new RpcError('CODEX_WORKSPACE_PATH_DENIED', 'The requested workspace path is unavailable.') }
  }

  private emit(terminal: TerminalContext, value: unknown): void {
    terminal.history.push(value)
    if (terminal.history.length > 512) terminal.history.shift()
    for (const subscriber of terminal.subscribers) subscriber.push(value)
  }
  private endSubscribers(terminal: TerminalContext): void {
    for (const subscriber of terminal.subscribers) subscriber.end()
    terminal.subscribers.clear()
  }

  private async requireTerminal(sessionId: string, id: string, _signal: AbortSignal): Promise<TerminalContext> {
    const terminal = this.terminals.get(`${sessionId}/${id}`)
    if (!terminal) throw new RpcError('CODEX_TERMINAL_NOT_FOUND', 'The CodeX terminal is no longer available.')
    return terminal
  }
  private assertTerminalEnabled(): void { if (!this.terminalEnabled()) throw new RpcError('TERMINAL_DISABLED', 'Remote terminal is disabled on this Host.') }
  private disposeTerminal(terminal: TerminalContext): void { if (!terminal.process.killed) terminal.process.kill(); this.endSubscribers(terminal) }
}

function argsOf(payload: unknown): Record<string, unknown> { const value = isRecord(payload) ? payload : {}; return isRecord(value.args) ? value.args : value }
function isRecord(value: unknown): value is Record<string, any> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function stringId(value: unknown): string { if (typeof value !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value)) throw new RpcError('INVALID_MESSAGE', 'The terminal identifier is invalid.'); return value }
function bounded(value: unknown, fallback: number, max: number): number { return typeof value === 'number' && Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback }
function readOffset(args: Record<string, unknown>): number { const range = isRecord(args.range) ? args.range : args; return typeof range.offset === 'number' && Number.isInteger(range.offset) && range.offset >= 0 ? range.offset : 0 }
function readLimit(args: Record<string, unknown>): number { const range = isRecord(args.range) ? args.range : args; return typeof range.limit === 'number' && Number.isInteger(range.limit) && range.limit > 0 ? Math.min(range.limit, MAX_READ_BYTES) : MAX_READ_BYTES }
function terminalInfo(terminal: TerminalContext): Record<string, unknown> { return { id: terminal.id, title: terminal.title, state: terminal.state, cols: terminal.cols, rows: terminal.rows, exitCode: terminal.exitCode } }
