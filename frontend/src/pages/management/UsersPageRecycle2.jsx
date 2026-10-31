import { useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import IconButton from '../../components/ui/IconButton'
import Modal from '../../components/ui/ModalAnimated'
import { useToast } from '../../app/toast'
import { addToRecycleBin, isInRecycleBin } from '../../app/recycleBin'

const seed = [
  { name: 'Ahmad Santoso', email: 'superadmin@local.test', role: 'Superadmin' },
  { name: 'Nadia Putri', email: 'admin@local.test', role: 'Admin' },
  { name: 'Budi Pratama', email: 'petugas@local.test', role: 'Officer' },
  { name: 'Siti Rahma', email: 'siti.rahma@email.test', role: 'Citizen' },
]

export default function UsersPageRecycle2() {
  const toast = useToast(); const [users, setUsers] = useState(() => seed.filter(user => !isInRecycleBin('users', user))); const [query, setQuery] = useState(''); const [modal, setModal] = useState(null); const [draft, setDraft] = useState({ name: '', email: '', role: 'Officer' })
  const list = users.filter(item => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(query.toLowerCase())); const close = () => setModal(null)
  const save = () => { if (!draft.name || !draft.email) return toast('Name and email are required.', 'error'); if (modal.mode === 'add') setUsers([...users, draft]); else setUsers(users.map(item => item.email === modal.user.email ? draft : item)); close(); toast('User saved successfully.') }
  const moveToBin = () => { addToRecycleBin('users', modal.user); setUsers(users.filter(item => item.email !== modal.user.email)); close(); toast('User moved to Recycle Bin.') }
  return <div className="management-page"><div className="page-toolbar"><div className="search-box"><Search size={17} /><input placeholder="Search by name, email, or role..." value={query} onChange={event => setQuery(event.target.value)} /></div><button className="primary-btn" onClick={() => { setDraft({ name: '', email: '', role: 'Officer' }); setModal({ mode: 'add' }) }}><Plus size={17} /> Add User</button></div><div className="panel table-panel"><div className="panel-head"><div><h2>User Management</h2><p>Manage administrator, officer, and citizen accounts.</p></div><Badge tone="blue">{users.length} users</Badge></div><div className="table-wrap"><table><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{list.map(user => <tr key={user.email}><td><div className="citizen"><div><b>{user.name}</b><small className="muted">{user.email}</small></div></div></td><td><Badge tone={user.role === 'Superadmin' ? 'red' : user.role === 'Officer' ? 'purple' : 'blue'}>{user.role}</Badge></td><td><Badge tone="green">Active</Badge></td><td><IconButton label="Edit user" onClick={() => { setDraft(user); setModal({ mode: 'edit', user }) }}><Pencil size={15} /></IconButton><IconButton label="Move user to Recycle Bin" onClick={() => setModal({ mode: 'delete', user })}><Trash2 size={15} /></IconButton></td></tr>)}</tbody></table></div></div>{(modal?.mode === 'add' || modal?.mode === 'edit') && <Modal title={modal.mode === 'add' ? 'Add User' : 'Edit User'} onClose={close} footer={<><button className="outline-btn" onClick={close}>Cancel</button><button className="primary-btn" onClick={save}>Save</button></>}><label className="modal-field">Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="modal-field">Email<input value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><label className="modal-field">Role<select value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })}><option>Admin</option><option>Officer</option><option>Citizen</option></select></label></Modal>}{modal?.mode === 'delete' && <Modal title="Move to Recycle Bin?" onClose={close} footer={<><button className="outline-btn" onClick={close}>Cancel</button><button className="danger-btn" onClick={moveToBin}>Move to Recycle Bin</button></>}><p><b>{modal.user.name}</b> will be moved to the Recycle Bin and can be restored later.</p></Modal>}</div>
}
