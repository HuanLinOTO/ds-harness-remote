import { describe, expect, it, vi } from 'vitest'
import { RemoteTypertGateway, type RemoteClientCore } from '@dsh-remote/client-core'
import { sessionPermissions } from '../src/services/session-permissions'
import type { RemoteSession } from '../src/types'
import { HarnessSessionTools } from '../src/services/session-tools'

function setup(value: unknown) {
  const rpc = vi.fn(async (..._args: unknown[]) => ({ ok: true, value }))
  const tools = new HarnessSessionTools(new RemoteTypertGateway({ rpc } as unknown as RemoteClientCore))
  return { rpc, tools }
}

describe('native session tools', () => {
  it('reads the new process catalog without changing permissions', async () => {
    const options = [{ value: 'read-only', name: 'Read only' }, { value: 'auto', name: 'Auto' }]
    const { tools, rpc } = setup({ options })
    await expect(tools.permissionOptions()).resolves.toEqual(options)
    expect(rpc).toHaveBeenCalledWith('harness.remote.call', { endpoint: 'permissionPresets/catalog', payload: { args: {} } }, expect.any(AbortSignal))
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed catalogs instead of inventing permission grants', async () => {
    await expect(setup({ options: [{ value: 'full' }] }).tools.permissionOptions()).rejects.toMatchObject({ code: 'INVALID_MESSAGE' })
  })
  it('keeps Host rejection authoritative without falling back to a different endpoint', async () => {
    const rpc = vi.fn(async () => ({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Unsupported', details: {} } }))
    const tools = new HarnessSessionTools(new RemoteTypertGateway({ rpc } as unknown as RemoteClientCore))
    await expect(tools.permissionOptions()).rejects.toMatchObject({ code: 'METHOD_NOT_ALLOWED' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('uses the official Session lookup for file listing and bounded reads', async () => {
    const { tools, rpc } = setup({})
    await tools.listFiles('s1', 'src')
    await tools.readFile('s1', 'src/main.ts', 201)
    expect(rpc.mock.calls.map(call => call.slice(0, 2))).toMatchObject([
      ['harness.remote.call', { endpoint: 'workspaceFiles/list', payload: { args: { workspaceFileScopeId: 's1', path: 'src' } } }],
      ['harness.remote.call', { endpoint: 'workspaceFiles/read', payload: { args: { workspaceFileScopeId: 's1', path: 'src/main.ts', range: { offset: 201, limit: 200 } } } }],
    ])
  })
})


describe('permission projection versions', () => {
  const session = (permissions?: unknown) => ({ sessionId: 's1', updatedAt: 0, running: false, blank: false, projections: { values: { permissions } } }) as RemoteSession
  it('preserves old inline options including deployment-specific presets', () => {
    const permissions = { currentValue: 'custom-preset', options: [{ value: 'custom-preset', name: 'Configured preset' }] }
    expect(sessionPermissions(session(permissions))).toEqual(permissions)
  })
  it('preserves 0.1.6 current selection while the separate catalog is loading', () => {
    expect(sessionPermissions(session({ currentValue: 'read-only' }))).toEqual({ currentValue: 'read-only', options: [] })
  })
  it('never invents a current permission for missing or malformed projections', () => {
    expect(sessionPermissions(session())).toBeUndefined()
    expect(sessionPermissions(session({ options: [] }))).toBeUndefined()
  })
})
