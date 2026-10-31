let coordinates = null
let locationRequested = false

export function requestLocation() {
  if (locationRequested || !navigator.geolocation) return
  locationRequested = true
  navigator.geolocation.getCurrentPosition(
    position => { coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude }; recordActivity('Location permission granted') },
    () => { recordActivity('Location unavailable or permission denied') },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  )
}

export function recordActivity(action) {
  let actor = 'Guest'
  try { actor = JSON.parse(localStorage.getItem('laporkita-auth') || 'null')?.email || 'Guest' } catch { /* invalid session */ }
  return fetch('/api/activity-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actor, action, ...coordinates }), keepalive: true }).catch(() => {})
}
