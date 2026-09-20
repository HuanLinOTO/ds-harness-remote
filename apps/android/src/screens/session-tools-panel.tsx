import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../ui/theme-context'
import { KeyboardInset } from '../ui/keyboard-inset'
import { TopBar } from '../ui/components'
import { strings as t } from '../locales/i18n'
import { WorkspaceFilesPanel } from './workspace-files-panel'
import { TerminalPanel } from './terminal-panel'

export function SessionToolsPanel({ mode, sessionId, onClose }: { mode: 'files' | 'terminal'; sessionId: string; onClose: () => void }) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  return <Modal visible onRequestClose={onClose} animationType="slide">
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardInset>
      <TopBar title={mode === 'files' ? t.tools.files : t.tools.terminal} onBack={onClose} />
      {mode === 'files' ? <WorkspaceFilesPanel sessionId={sessionId} /> : <TerminalPanel sessionId={sessionId} />}
      </KeyboardInset>
    </View>
  </Modal>
}
const styles = StyleSheet.create({ container: { flex: 1 } })
