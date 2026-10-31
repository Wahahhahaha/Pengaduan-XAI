import { useEffect, useLayoutEffect, useState } from 'react'

let settingsCache = { website_name: '' }

export function readWebsiteSettings() { return settingsCache }

export async function loadWebsiteSettings() {
  const response = await fetch('/api/settings')
  if (!response.ok) throw new Error('Unable to load website settings.')
  settingsCache = await response.json()
  window.dispatchEvent(new CustomEvent('laporkita-settings-updated', { detail: settingsCache }))
  return settingsCache
}

export function setWebsiteSettings(settings) {
  settingsCache = { ...settingsCache, ...settings }
  window.dispatchEvent(new CustomEvent('laporkita-settings-updated', { detail: settingsCache }))
}

export default function useWebsiteSettings() {
  const [settings, setSettings] = useState(readWebsiteSettings)
  useLayoutEffect(() => {
    document.title = settings.website_name || 'LaporKita'
    if (settings.favicon) {
      let icon = document.querySelector('link[rel="icon"]')
      if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon) }
      icon.href = settings.favicon
    }
  }, [settings.website_name, settings.favicon])
  useEffect(() => {
    const update = event => setSettings(event.detail || readWebsiteSettings())
    window.addEventListener('laporkita-settings-updated', update)
    loadWebsiteSettings().catch(() => {})
    return () => window.removeEventListener('laporkita-settings-updated', update)
  }, [])
  return settings
}
