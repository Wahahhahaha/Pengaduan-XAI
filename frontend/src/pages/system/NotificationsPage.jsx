import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, DatabaseBackup, MessageSquareWarning, Sparkles, Trash2 } from 'lucide-react'
import { recordActivity } from '../../app/activity'

const iconByKind = { complaint: MessageSquareWarning, ai: Sparkles, backup: DatabaseBackup }

export default function NotificationsPage() {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications')
      if (!response.ok) throw new Error('Failed to load notifications')
      const data = await response.json()
      setItems(data.items || [])
      setUnread(data.unread || 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  const markRead = async id => { const response = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }); if (response.ok) recordActivity(`Read notification ${items.find(item => item.id === id)?.title || id}`); load() }
  const markAllRead = async () => { const response = await fetch('/api/notifications/read-all', { method: 'POST' }); if (response.ok) recordActivity(`Read all notifications (${unread} unread)`); load() }
  const remove = async id => { const response = await fetch(`/api/notifications/${id}`, { method: 'DELETE' }); if (response.ok) recordActivity(`Deleted notification ${items.find(item => item.id === id)?.title || id}`); load() }

  return <section className="notifications-page">
    <div className="notifications-page-head">
      <div><span className="eyebrow">SYSTEM</span><h2>Notifications</h2><p>Live updates from complaints, AI analysis, and system operations.</p></div>
      {unread > 0 && <button className="notification-mark-all" onClick={markAllRead}><Check size={16} /> <span>Mark all as read</span></button>}
    </div>
    <div className="notification-list-card">
      {loading ? <div className="notification-page-empty">Loading notifications...</div> : items.length === 0 ? <div className="notification-page-empty"><Bell size={28} /><b>No notifications</b><span>You are all caught up.</span></div> : items.map(item => {
        const Icon = iconByKind[item.kind] || Bell
        return <article className={`notification-page-item ${item.is_read ? '' : 'unread'}`} key={item.id}>
          <div className={`notification-page-icon ${item.kind || 'info'}`}><Icon size={19} /></div>
          <div className="notification-page-copy"><div className="notification-page-title"><b>{item.title}</b>{!item.is_read && <span>New</span>}</div><p>{item.message}</p><small>{item.time || item.created_at}</small></div>
          <div className="notification-page-actions">{!item.is_read && <button className="icon-btn" aria-label={`Mark ${item.title} as read`} title="Mark as read" onClick={() => markRead(item.id)}><Check size={16} /></button>}<button className="icon-btn danger" aria-label={`Delete ${item.title}`} title="Delete notification" onClick={() => remove(item.id)}><Trash2 size={16} /></button></div>
        </article>
      })}
    </div>
  </section>
}
