import { useCallback, useEffect, useState } from 'react'
import { DatabaseBackup, Download, RefreshCw } from 'lucide-react'
import { useToast } from '../../app/toast'
import { recordActivity } from '../../app/activity'

function formatSize(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
function formatDate(value) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }

export default function BackupPage() {
  const toast = useToast()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const loadBackups = useCallback(async () => { try { setError(''); const response = await fetch('/api/backups'); if (!response.ok) throw new Error('Daftar backup gagal dimuat'); setBackups(await response.json()) } catch (err) { setError(err.message) } finally { setLoading(false) } }, [])
  useEffect(() => { loadBackups() }, [loadBackups])
  const createBackup = async () => { setCreating(true); try { const response = await fetch('/api/backups', { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Backup database gagal'); recordActivity(`Created database backup ${data.filename}`); toast('Backup database berhasil dibuat.'); await loadBackups() } catch (err) { toast(err.message, 'error') } finally { setCreating(false) } }
  return <div className="backup-page"><div className="backup-hero panel"><div><div className="backup-icon"><DatabaseBackup size={24} /></div><h2>Backup Database</h2><p>Buat dan unduh salinan database PostgreSQL untuk menjaga keamanan data operasional.</p></div><button className="primary-btn" onClick={createBackup} disabled={creating}>{creating ? <RefreshCw className="spin" size={16} /> : <DatabaseBackup size={16} />} {creating ? 'Membuat Backup…' : 'Buat Backup'}</button></div><div className="panel backup-list"><div className="panel-head"><div><h2>Riwayat Backup</h2><p>Daftar file backup yang tersedia untuk diunduh.</p></div><button className="icon-btn" onClick={loadBackups} aria-label="Muat ulang daftar backup" title="Muat ulang"><RefreshCw size={16} /></button></div>{error && <div className="dashboard-notice error">{error}</div>}{loading ? <div className="empty-chart">Memuat daftar backup…</div> : backups.length === 0 ? <div className="empty-chart">Belum ada backup. Klik “Buat Backup” untuk membuat file pertama.</div> : <div className="backup-table-wrap"><table><thead><tr><th>NAMA FILE</th><th>WAKTU DIBUAT</th><th>UKURAN</th><th /></tr></thead><tbody>{backups.map(item => <tr key={item.filename}><td><b>{item.filename}</b></td><td className="muted">{formatDate(item.created_at)}</td><td className="muted">{formatSize(item.size)}</td><td><a className="icon-btn" href={`/api/backups/${encodeURIComponent(item.filename)}`} download={item.filename} aria-label={`Download ${item.filename}`} title="Download"><Download size={16} /></a></td></tr>)}</tbody></table></div>}</div></div>
}
