const MASTER_KEYS = { users: 'laporkita-users', categories: 'laporkita-categories' }
import { recordActivity } from './activity'

export function getMasterData(type, fallback) {
  try { const saved = JSON.parse(localStorage.getItem(MASTER_KEYS[type]) || 'null'); return Array.isArray(saved) ? saved : fallback } catch { return fallback }
}

export function saveMasterData(type, data) { localStorage.setItem(MASTER_KEYS[type], JSON.stringify(data)); window.dispatchEvent(new Event('master-data-updated')); recordActivity(`Updated master data: ${type}`) }

export async function restoreMasterItem(item) {
  if (item.type === 'users') {
    const response = await fetch(`/api/users/${encodeURIComponent(item.data.email)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.data) })
    if (!response.ok) throw new Error('Unable to restore user.')
    const users = getMasterData('users', [])
    if (!users.some(user => user.email === item.data.email)) saveMasterData('users', [...users, item.data])
  }
  if (item.type === 'categories') { const data = getMasterData(item.type, []); const row = [item.data.name, item.data.description || '', item.data.status || '0']; if (!data.some(existing => existing[0] === row[0])) saveMasterData(item.type, [...data, row]) }
}
