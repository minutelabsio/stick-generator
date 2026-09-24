import { onBeforeUnmount, onMounted } from 'vue'

type ShortcutHandler = (event: KeyboardEvent) => unknown

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]'

export const MOD_KEY_LABEL = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

// Bindings are keyed by KeyboardEvent.key, with "mod+" in front for ⌘ on macOS and
// Ctrl elsewhere, e.g. "ArrowLeft", "?", "mod+s", "mod+enter".
const shortcutKey = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey ? `mod+${event.key.toLowerCase()}` : event.key)

const isTypingIn = (target: EventTarget | null) => target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null

export function useShortcuts(bindings: Record<string, ShortcutHandler>) {
  function onKeydown(event: KeyboardEvent) {
    // A focused widget (select, listbox, grid) that handled the key keeps it.
    if (event.defaultPrevented) return
    const key = shortcutKey(event)
    const handler = bindings[key]
    if (!handler) return
    const isModified = key.startsWith('mod+')
    if (!isModified && isTypingIn(event.target)) return
    event.preventDefault()
    void handler(event)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
