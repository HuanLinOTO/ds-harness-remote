import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { requireSessionTools } from '../state/store'
import { createNativeRpcId } from '../services/api-proxy'
import { TerminalAttachment } from '../services/terminal-attachment'
import type { TerminalInfo } from '../services/session-tools'
import { terminalHtml } from '../generated/terminal-html'
import { strings as t } from '../locales/i18n'
import { Button } from '../ui/components'
import { useTheme } from '../ui/theme-context'
import { spacing, type } from '../ui/theme'
import { sessionToolsError } from './session-tools-error'

const SOURCE = { html: terminalHtml, baseUrl: 'about:blank' }

export function TerminalPanel({ sessionId }: { sessionId: string }) {
  const { colors } = useTheme()
  const web = useRef<WebView>(null)
  const attachment = useRef<TerminalAttachment | undefined>(undefined)
  const pendingAck = useRef<{ id: number; resolve: () => void; reject: () => void } | undefined>(undefined)
  const ackId = useRef(0)
  const dimensions = useRef({ cols: 80, rows: 24 })
  const limits = useRef({ maxCols: 240, maxRows: 100 })
  const [ready, setReady] = useState(false)
  const [items, setItems] = useState<TerminalInfo[]>([])
  const [active, setActive] = useState<string>()
  const [info, setInfo] = useState<TerminalInfo>()
  const [writable, setWritable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [revision, setRevision] = useState(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; attachment.current?.dispose(); pendingAck.current?.reject() } }, [])
  const send = (value: unknown) => web.current?.injectJavaScript(`window.receive(${JSON.stringify(value)});true;`)

  const render = (data: string, reset: boolean) => new Promise<void>((resolve, reject) => {
    const id = ++ackId.current
    const timer = setTimeout(() => { if (pendingAck.current?.id === id) pendingAck.current = undefined; reject(new Error('Terminal render timeout')) }, 10000)
    pendingAck.current = { id, resolve: () => { clearTimeout(timer); resolve() }, reject: () => { clearTimeout(timer); reject(new Error('Terminal detached')) } }
    send({ type: 'write', data, reset, id })
  })

  useEffect(() => {
    let cancelled = false
    setBusy(true); setError(undefined)
    void Promise.resolve().then(() => requireSessionTools().listTerminals(sessionId))
      .then(result => { if (!cancelled) { setItems(result); setActive(value => result.some(item => item.id === value) ? value : result[0]?.id) } })
      .catch(e => { if (!cancelled) setError(sessionToolsError(e)) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [sessionId, revision])

  useEffect(() => {
    if (!ready || active === undefined) return
    let cancelled = false
    setWritable(false); setInfo(undefined); setError(undefined)
    const run = async () => {
      const tools = requireSessionTools()
      const environment = await tools.terminalEnvironment(sessionId)
      if (cancelled) return
      limits.current = environment
      const current = new TerminalAttachment(tools, sessionId, active, environment.maxInputBytes, render, (next, canWrite) => {
        if (cancelled) return
        setInfo(next); setWritable(canWrite); send({ type: 'enabled', value: canWrite })
      })
      attachment.current = current
      await current.follow()
    }
    void run().catch(e => { if (!cancelled) { setError(sessionToolsError(e)); setWritable(false); send({ type: 'enabled', value: false }) } })
    return () => {
      cancelled = true
      attachment.current?.dispose(); attachment.current = undefined
      pendingAck.current?.reject(); pendingAck.current = undefined
      send({ type: 'enabled', value: false })
    }
  }, [active, ready, sessionId, revision])

  useEffect(() => {
    if (!writable) return
    void attachment.current?.resize(Math.min(dimensions.current.cols, limits.current.maxCols), Math.min(dimensions.current.rows, limits.current.maxRows))
      .catch(e => { if (mounted.current) setError(sessionToolsError(e)) })
  }, [writable])

  const input = (data: string) => {
    if (!writable) return
    const current = attachment.current
    void current?.write(data).catch(() => {
      if (!mounted.current || attachment.current !== current) return
      setWritable(false); setError(t.tools.disconnected); send({ type: 'enabled', value: false })
    })
  }
  const create = async () => {
    setBusy(true); setError(undefined)
    try {
      const tools = requireSessionTools()
      const env = await tools.terminalEnvironment(sessionId)
      const result = await tools.createTerminal(sessionId, createNativeRpcId(), Math.min(dimensions.current.cols, env.maxCols), Math.min(dimensions.current.rows, env.maxRows))
      if (mounted.current) { setItems(old => [...old, result]); setActive(result.id) }
    } catch (e) { if (mounted.current) setError(sessionToolsError(e)) }
    finally { if (mounted.current) setBusy(false) }
  }
  const close = () => {
    const id = active
    if (!id) return
    Alert.alert(t.tools.closeTerminal, t.tools.closeBody, [{ text: t.common.cancel, style: 'cancel' }, { text: t.tools.closeTerminal, style: 'destructive', onPress: () => {
      setBusy(true)
      void Promise.resolve().then(() => requireSessionTools().closeTerminal(sessionId, id)).then(() => {
        if (!mounted.current) return
        attachment.current?.dispose(); setActive(undefined); setRevision(v => v + 1)
      }).catch(e => { if (mounted.current) setError(sessionToolsError(e)) }).finally(() => { if (mounted.current) setBusy(false) })
    } }])
  }
  return <View style={styles.container}>
    <Text style={[styles.hint, { color: colors.muted }]}>{t.tools.terminalHint}</Text>
    <ScrollView horizontal style={styles.controls} contentContainerStyle={styles.row}>
      <Button label={t.tools.newTerminal} onPress={() => void create()} disabled={busy || !ready} variant="secondary" />
      {items.map(item => <Button key={item.id} label={item.title} variant={active === item.id ? 'primary' : 'quiet'} onPress={() => setActive(item.id)} disabled={busy} />)}
      {active && <Button label={t.tools.closeTerminal} variant="danger" disabled={busy} onPress={close} />}
    </ScrollView>
    {busy && <ActivityIndicator color={colors.primary} />}
    {error && <View style={styles.notice}><Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text><Button label={t.tools.retry} variant="secondary" disabled={busy} onPress={() => setRevision(v => v + 1)} /></View>}
    {active && !info && !error && <Text style={[styles.hint, { color: colors.muted }]}>{t.tools.connecting}</Text>}
    {info && !writable && !error && <Text style={[styles.hint, { color: colors.muted }]}>{info.state === 'running' ? t.tools.controlDenied : t.tools.exited}</Text>}
    <WebView accessibilityLabel={t.tools.terminal} ref={web} source={SOURCE} style={styles.container} originWhitelist={['*']} javaScriptEnabled
      allowFileAccess={false} allowUniversalAccessFromFileURLs={false} mixedContentMode="never" setSupportMultipleWindows
      onOpenWindow={() => undefined} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
      onError={() => { attachment.current?.dispose(); setWritable(false); setReady(false); setError(t.tools.failed) }}
      onMessage={event => {
        try {
          const value = JSON.parse(event.nativeEvent.data)
          if (value.type === 'ready') setReady(true)
          if ((value.type === 'ready' || value.type === 'resize') && Number.isInteger(value.cols) && value.cols > 0 && Number.isInteger(value.rows) && value.rows > 0) {
            dimensions.current = { cols: value.cols, rows: value.rows }
            void attachment.current?.resize(Math.min(value.cols, limits.current.maxCols), Math.min(value.rows, limits.current.maxRows)).catch(e => { if (mounted.current) setError(sessionToolsError(e)) })
          }
          if (value.type === 'ack') {
            const ack = pendingAck.current
            if (ack !== undefined && ack.id === value.id) { ack.resolve(); pendingAck.current = undefined }
          }
          if (value.type === 'data' && typeof value.data === 'string') input(value.data)
        } catch { /* Ignore malformed renderer messages. */ }
      }} />
    <ScrollView horizontal keyboardShouldPersistTaps="always" style={styles.controls} contentContainerStyle={styles.row}>
      <Button label={t.tools.keyboard} variant="secondary" disabled={!writable} onPress={() => send({ type: 'focus' })} />
      {([[t.tools.interrupt, '\x03'], [t.tools.tab, '\t'], [t.tools.escape, '\x1b'], [t.tools.up, '\x1b[A'], [t.tools.down, '\x1b[B'], [t.tools.left, '\x1b[D'], [t.tools.right, '\x1b[C'], [t.tools.backspace, '\x7f'], [t.tools.enter, '\r']] as const).map(([label, data]) => <Button key={label} label={label} variant="secondary" disabled={!writable} onPress={() => input(data)} />)}
    </ScrollView>
  </View>
}
const styles = StyleSheet.create({ container: { flex: 1 }, hint: { ...type.caption, padding: spacing.sm }, controls: { flexGrow: 0 }, row: { gap: spacing.sm, padding: spacing.sm, alignItems: 'center' }, notice: { padding: spacing.sm, gap: spacing.sm } })
