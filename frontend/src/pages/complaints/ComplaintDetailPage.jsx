import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ClipboardCheck, FileImage, History, Send, X } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import './ComplaintDetailPage.css'
import { useToast } from '../../app/toast'
import ImageCropModal from '../../components/ui/ImageCropModal'

const priorities = ['Low', 'Medium', 'High', 'Urgent']
const statuses = ['Pending Verification', 'Verified', 'Assigned', 'In Progress', 'Waiting Confirmation', 'Completed', 'Rejected']
const nextStatus = { 'Pending Verification': 'Verified', Verified: 'Assigned', Assigned: 'In Progress', 'In Progress': 'Waiting Confirmation', 'Waiting Confirmation': 'Completed' }
const statusLabels = { 'Menunggu Verifikasi': 'Pending Verification', Diverifikasi: 'Verified', Ditugaskan: 'Assigned', 'Dalam Penanganan': 'In Progress', 'Menunggu Konfirmasi': 'Waiting Confirmation', Selesai: 'Completed', Ditolak: 'Rejected' }
const priorityLabels = { Rendah: 'Low', Sedang: 'Medium', Tinggi: 'High', Mendesak: 'Urgent' }
const priorityTone = { Urgent: 'red', High: 'amber', Medium: 'blue', Low: 'neutral' }
const englishStatus = value => statusLabels[value] || value || 'Pending Verification'
const englishPriority = value => priorityLabels[value] || value || 'Medium'

export default function ComplaintDetailPage() {
  const { id } = useParams(); const location = useLocation(); const isCitizen = location.pathname.startsWith('/citizen')
  const [row, setRow] = useState(null); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [evidence, setEvidence] = useState(null); const [cropFile, setCropFile] = useState(null); const toast = useToast()
  const [form, setForm] = useState({ status: 'Pending Verification', final_priority: 'Medium', note: '' })
  const load = () => fetch(`/api/complaints/${encodeURIComponent(id)}`).then(response => { if (!response.ok) throw new Error('Complaint not found'); return response.json() }).then(data => { setRow(data); setForm({ status: englishStatus(data.status), final_priority: englishPriority(data.final_priority || data.priority), note: '' }); setEvidence(data.resolution_image_data ? { name: 'Resolution evidence', data: data.resolution_image_data } : null) }).catch(err => setError(err.message))
  useEffect(() => { load() }, [id])
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const saveWorkflow = async targetStatus => {
    const next = targetStatus || nextStatus[form.status]
    if (!next) { toast('This complaint has reached a final status.', 'error'); return }
    if (next === 'Rejected' && form.note.trim().length < 5) { toast('A rejection reason is required.', 'error'); return }
    setSaving(true); setError('')
    try {
      const auth = JSON.parse(localStorage.getItem('laporkita-auth') || '{}')
      const response = await fetch(`/api/complaints/${encodeURIComponent(id)}/workflow`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, status: next, evidence_image_data: evidence?.data || '', actor: auth.name || 'Officer' }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Unable to save workflow.')
      toast('Workflow decision saved successfully.'); await load()
    } catch (err) { toast(err.message || 'Unable to save workflow.', 'error') } finally { setSaving(false) }
  }
  const back = isCitizen ? '/citizen/complaints' : '/admin/complaints'
  if (error && !row) return <div className="placeholder panel"><h2>{error}</h2><Link className="primary-btn" to={back}>Back to complaints</Link></div>
  if (!row) return <div className="placeholder panel"><p>Loading complaint details…</p></div>
  return <div className="panel detail-page">
    <Link className="link-btn" to={back}>← Back</Link>
    <div className="detail-header"><div><Badge tone={englishStatus(row.status) === 'Completed' ? 'green' : englishStatus(row.status) === 'Pending Verification' ? 'amber' : 'blue'}>{englishStatus(row.status)}</Badge><h3>{row.title}</h3><p className="drawer-description">Reference: {row.id}. {row.description || 'No additional description provided.'}</p></div><Badge tone={priorityTone[englishPriority(row.final_priority || row.priority)] || 'blue'}>{englishPriority(row.final_priority || row.priority)}</Badge></div>
    <div className="detail-grid"><div><span className="eyebrow">REPORTER</span><b>{row.citizen_name}</b></div><div><span className="eyebrow">CATEGORY</span><b>{row.category}</b></div><div><span className="eyebrow">AI RECOMMENDATION</span><Badge tone={priorityTone[englishPriority(row.ai_priority || row.priority)] || 'blue'}>{englishPriority(row.ai_priority || row.priority)}</Badge></div></div>
    {!isCitizen && <div className="workflow-panel"><div className="panel-head"><div><h2><ClipboardCheck size={17} /> Verification & follow-up</h2><p>Set the final decision after reviewing the AI recommendation.</p></div></div><div className="workflow-fields"><div className="workflow-field workflow-status-field"><span>Current status</span><strong>{form.status}</strong><small>Next step: {nextStatus[form.status] || 'Final status'}</small></div><div className="workflow-field"><span>Final priority</span><select value={form.final_priority} disabled={form.status !== 'Pending Verification'} onChange={event => update('final_priority', event.target.value)}>{priorities.map(priority => <option key={priority}>{priority}</option>)}</select>{form.status !== 'Pending Verification' && <small className="field-help">Locked after verification</small>}</div></div>{form.status === 'In Progress' && <div className="evidence-upload"><span>Resolution evidence</span><label className="photo-input"><FileImage size={18} /><span>{evidence ? evidence.name : 'Choose an image (optional, max 5 MB)'}</span><input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (!file.type.startsWith('image/')) return toast('Please select an image file.', 'error'); if (file.size > 5 * 1024 * 1024) return toast('Image size must be 5 MB or less.', 'error'); setCropFile(file) }} /></label>{evidence && <span className="photo-preview"><img src={evidence.data} alt="Resolution evidence preview" /><button type="button" aria-label="Remove evidence" onClick={() => setEvidence(null)}><X size={15} /></button></span>}{cropFile && <ImageCropModal file={cropFile} onCancel={() => setCropFile(null)} onApply={result => { setEvidence(result); setCropFile(null) }} />}</div>}<div className="workflow-note"><span>Action note / change reason</span><textarea value={form.note} onChange={event => update('note', event.target.value)} placeholder="Example: Priority increased because ambulance access is blocked." /></div><div className="workflow-actions"><button className="primary-btn" onClick={() => saveWorkflow()} disabled={saving || !nextStatus[form.status]}><Send size={15} /> {saving ? 'Saving…' : nextStatus[form.status] ? `Move to ${nextStatus[form.status]}` : 'Completed'}</button>{form.status !== 'Completed' && form.status !== 'Rejected' && <button className="reject-btn" onClick={() => saveWorkflow('Rejected')} disabled={saving}>Reject complaint</button>}</div></div>}
    <div className="timeline-panel"><h2><History size={17} /> Workflow history</h2>{row.events?.length ? row.events.map((event, index) => <div className="timeline-item" key={`${event.created_at}-${index}`}><span className="timeline-dot" /><div><b>{englishStatus(event.status)}</b><small>{event.created_at} · {event.actor}</small>{event.note && <p>{event.note}</p>}</div></div>) : <p className="muted">No workflow history yet.</p>}</div>
  </div>
}
