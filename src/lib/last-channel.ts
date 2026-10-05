// Per designer, per browser. Stored by id rather than slug so a renamed channel is
// still found.
const STORAGE_KEY = 'stick-generator.last-channel'

export function readLastChannelId() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function rememberChannelId(channelId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, channelId)
  } catch {
    // Storage can be blocked (private windows). The app then opens on the first channel.
  }
}
