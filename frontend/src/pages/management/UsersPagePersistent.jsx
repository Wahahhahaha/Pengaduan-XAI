import { useEffect, useState } from 'react'
import { ChevronDown, KeyRound, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import IconButton from '../../components/ui/IconButton'
import Modal from '../../components/ui/ModalAnimated'
import { useToast } from '../../app/toast'
import { getAuth } from '../../app/permissions'
import { recordActivity } from '../../app/activity'

async function readUsers() {
  const response = await fetch('/api/users')
  if (!response.ok) throw new Error('Unable to load users.')
  return (await response.json()).items.filter(user => user.active && !user.deleted_at)
}

function RoleSelect({ roles, value, onChange }) {
  const availableRoles = roles.filter(role => role.key !== 'superadmin' || value === role.name)
  return <label className="modal-field user-role-field">Role
    <span className="user-role-control"><ShieldCheck size={18} aria-hidden="true" /><select aria-label="User role" value={value} disabled={!availableRoles.length} onChange={event => onChange(event.target.value)}><option value="" disabled>Select a role</option>{availableRoles.map(role => <option key={role.id} value={role.name}>{role.name}</option>)}</select><ChevronDown className="user-role-chevron" size={17} aria-hidden="true" /></span>
    <small>Access rights follow the selected role.</small>
  </label>
}

export default function UsersPagePersistent() {
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [modal, setModal] = useState(null)
  const [draft, setDraft] = useState({ name: '', email: '', role: '', password: '', managerPassword: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    readUsers().then(rows => { if (active) setUsers(rows) }).catch(error => toast(error.message, 'error'))
    fetch('/api/roles').then(response => response.json()).then(data => { if (active) setRoles(data.items) }).catch(error => toast(error.message, 'error'))
    return () => { active = false }
  }, [toast])

  const list = users.filter(user =>
    (roleFilter === 'all' || user.role_key === roleFilter) &&
    `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.trim().toLowerCase())
  ).sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : sortBy === 'role' ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name) : b.id - a.id)
  const close = () => setModal(null)
  const save = async () => {
    if (!draft.name.trim() || !draft.email.trim()) return toast('Name and email are required.', 'error')
    if (modal.mode === 'add' && draft.password.length < 6) return toast('Password must be at least 6 characters.', 'error')
    setSaving(true)
    try {
      const oldEmail = modal.mode === 'edit' ? modal.user.email : draft.email
      const payload = { name: draft.name, email: draft.email, role: draft.role, ...(draft.password ? { password: draft.password } : {}) }
      const response = await fetch(`/api/users/${encodeURIComponent(oldEmail)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to save user.')
      setUsers(await readUsers())
      recordActivity(`${modal.mode === 'add' ? 'Created' : 'Updated'} user ${draft.name} (${draft.email}) with role ${draft.role}`)
      close()
      toast('User saved successfully.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  const moveToBin = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(modal.user.email)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Unable to delete user.')
      setUsers(await readUsers())
      recordActivity(`Deleted user ${modal.user.name} (${modal.user.email}); moved to Recycle Bin`)
      close()
      toast('User moved to Recycle Bin.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  const resetPassword = async () => {
    if (draft.password.length < 6) return toast('Password must be at least 6 characters.', 'error')
    if (!draft.managerPassword) return toast('Enter your password to confirm.', 'error')
    setSaving(true)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(modal.user.email)}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager_email: getAuth()?.email, manager_password: draft.managerPassword, new_password: draft.password }) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to reset password.')
      recordActivity(`Reset password for user ${modal.user.name} (${modal.user.email})`)
      close()
      toast('Password reset successfully.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  const openAdd = () => {
    setDraft({ name: '', email: '', role: roles.find(role => role.key === 'petugas')?.name || roles.find(role => role.key !== 'superadmin')?.name || '', password: '', managerPassword: '' })
    setModal({ mode: 'add' })
  }
  const openEdit = (mode, user) => { setDraft({ ...user, password: '', managerPassword: '' }); setModal({ mode, user }) }

  return <div className="management-page">
    <div className="page-toolbar user-filters"><div className="search-box"><Search size={17} /><input aria-label="Search users" placeholder="Search by name, email, or role..." value={query} onChange={event => setQuery(event.target.value)} /></div><select aria-label="Filter by role" value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map(role => <option key={role.id} value={role.key}>{role.name}</option>)}</select><select aria-label="Sort users" value={sortBy} onChange={event => setSortBy(event.target.value)}><option value="newest">Newest first</option><option value="name">Name A–Z</option><option value="role">Role A–Z</option></select><button className="primary-btn" onClick={openAdd}><Plus size={17} /> Add User</button></div>
    <div className="panel table-panel"><div className="panel-head"><div><h2>User Management</h2><p>Manage administrator, officer, and citizen accounts.</p></div><Badge tone="blue">{list.length} of {users.length} users</Badge></div><div className="table-wrap"><table><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{list.map(user => <tr key={user.id}><td><div className="citizen"><div><b>{user.name}</b><small className="muted">{user.email}</small></div></div></td><td><Badge tone={user.role === 'Superadmin' ? 'red' : user.role === 'Officer' ? 'purple' : 'blue'}>{user.role}</Badge></td><td><Badge tone="green">Active</Badge></td><td><IconButton label="Edit user" onClick={() => openEdit('edit', user)}><Pencil size={15} /></IconButton><IconButton label="Reset password" onClick={() => openEdit('reset', user)}><KeyRound size={15} /></IconButton><IconButton label="Move user to Recycle Bin" onClick={() => setModal({ mode: 'delete', user })}><Trash2 size={15} /></IconButton></td></tr>)}</tbody></table>{list.length === 0 && <div className="empty-chart">No users match the current filters.</div>}</div></div>
    {(modal?.mode === 'add' || modal?.mode === 'edit') && <Modal title={modal.mode === 'add' ? 'Add User' : 'Edit User'} onClose={close} footer={<><button className="outline-btn" onClick={close}>Cancel</button><button className="primary-btn" disabled={saving} onClick={save}>Save</button></>}><label className="modal-field">Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label><label className="modal-field">Email<input value={draft.email} onChange={event => setDraft({ ...draft, email: event.target.value })} /></label><RoleSelect roles={roles} value={draft.role} onChange={role => setDraft({ ...draft, role })} />{modal.mode === 'add' && <label className="modal-field">Password<input type="password" value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} /></label>}</Modal>}
    {modal?.mode === 'reset' && <Modal title="Reset Password" onClose={close} footer={<><button className="outline-btn" onClick={close}>Cancel</button><button className="primary-btn" disabled={saving} onClick={resetPassword}>Reset Password</button></>}><p>Enter a new password for <b>{modal.user.name}</b>.</p><label className="modal-field">New Password<input type="password" value={draft.password} onChange={event => setDraft({ ...draft, password: event.target.value })} /></label><label className="modal-field">Your Password<input type="password" value={draft.managerPassword} onChange={event => setDraft({ ...draft, managerPassword: event.target.value })} /></label></Modal>}
    {modal?.mode === 'delete' && <Modal title="Delete user?" onClose={close} footer={<><button className="outline-btn" onClick={close}>Cancel</button><button className="danger-btn" disabled={saving} onClick={moveToBin}>Delete</button></>}><p>Are you sure you want to delete <b>{modal.user.name}</b>?</p></Modal>}
  </div>
}
