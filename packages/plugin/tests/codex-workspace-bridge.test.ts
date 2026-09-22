import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CodexWorkspaceBridge } from '../src/codex-workspace-bridge.js'

const signal = new AbortController().signal

describe('CodeX workspace and terminal bridge', () => {
  it('maps file calls to each thread cwd and rejects traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-codex-'))
    const other = await mkdtemp(join(tmpdir(), 'dsh-codex-other-'))
    await writeFile(join(root, 'hello.txt'), 'hello')
    await writeFile(join(other, 'secret.txt'), 'secret')
    const bridge = new CodexWorkspaceBridge(async thread => thread === 'one' ? root : other, () => true)
    await expect(bridge.call('workspaceFiles/list', { args: { workspaceFileScopeId: 'codex:one', path: '.' } }, signal)).resolves.toMatchObject({ ok: true, value: { entries: [{ name: 'hello.txt' }] } })
    await expect(bridge.call('workspaceFiles/read', { args: { workspaceFileScopeId: 'codex:one', path: 'hello.txt', range: { offset: 0, limit: 5 } } }, signal)).resolves.toMatchObject({ ok: true, value: { text: 'hello' } })
    await expect(bridge.call('workspaceFiles/readBytes', { args: { workspaceFileScopeId: 'codex:one', path: '../secret.txt' } }, signal)).rejects.toMatchObject({ code: 'CODEX_WORKSPACE_PATH_DENIED' })
    await bridge.closeAll(); await rm(root, { recursive: true, force: true }); await rm(other, { recursive: true, force: true })
  })

  it('returns stable errors for invalid or cwd-less threads', async () => {
    const bridge = new CodexWorkspaceBridge(async thread => thread === 'missing' ? undefined : '/does/not/exist', () => true)
    await expect(bridge.call('workspaceFiles/list', { args: { workspaceFileScopeId: 'codex:missing', path: '.' } }, signal)).rejects.toMatchObject({ code: 'CODEX_WORKSPACE_UNAVAILABLE' })
    await expect(bridge.call('workspaceFiles/list', { args: { workspaceFileScopeId: 'codex:', path: '.' } }, signal)).rejects.toMatchObject({ code: 'CODEX_SESSION_INVALID' })
    await bridge.closeAll()
  })

  it('keeps terminal contexts isolated by CodeX thread', async () => {
    const one = await mkdtemp(join(tmpdir(), 'dsh-codex-one-'))
    const two = await mkdtemp(join(tmpdir(), 'dsh-codex-two-'))
    const bridge = new CodexWorkspaceBridge(async thread => thread === 'one' ? one : two, () => true)
    await bridge.call('terminal/create', { args: { agentId: 'codex:one', request: { id: 't1', cols: 80, rows: 24 } } }, signal)
    await expect(bridge.call('terminal/list', { args: { sessionId: 'codex:two' } }, signal)).resolves.toMatchObject({ ok: true, value: [] })
    await expect(bridge.call('terminal/write', { args: { agentId: 'codex:two', id: 't1', data: 'x' } }, signal)).rejects.toMatchObject({ code: 'CODEX_TERMINAL_NOT_FOUND' })
    await expect(bridge.call('terminal/rename', { args: { agentId: 'codex:one', id: 't1', title: 'renamed' } }, signal)).resolves.toMatchObject({ ok: true, value: { title: 'renamed' } })
    await bridge.call('terminal/close', { args: { agentId: 'codex:one', id: 't1' } }, signal)
    await expect(bridge.call('terminal/list', { args: { sessionId: 'codex:one' } }, signal)).resolves.toMatchObject({ ok: true, value: [] })
    await bridge.closeAll(); await rm(one, { recursive: true, force: true }); await rm(two, { recursive: true, force: true })
  })
})
