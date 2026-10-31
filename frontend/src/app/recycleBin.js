const RECYCLE_BIN_KEY = 'laporkita-recycle-bin'
import { recordActivity } from './activity'
export function getRecycleBin() { try { return JSON.parse(localStorage.getItem(RECYCLE_BIN_KEY) || '[]') } catch { return [] } }
export function saveRecycleBin(items) { localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(items)); window.dispatchEvent(new Event('recycle-bin-updated')) }
export function addToRecycleBin(type, data) { const items = getRecycleBin(); const identity = data.email || data.name || data[0]; if (items.some(item => item.type === type && item.identity === identity)) return; saveRecycleBin([{ id: `${type}-${Date.now()}`, type, identity, data, deletedAt: new Date().toISOString() }, ...items]); recordActivity(`Moved ${type} to Recycle Bin: ${identity}`) }
export function isInRecycleBin(type, data) { const identity = data.email || data.name || data[0]; return getRecycleBin().some(item => item.type === type && item.identity === identity) }
export function removeFromRecycleBin(id) { saveRecycleBin(getRecycleBin().filter(item => item.id !== id)) }
