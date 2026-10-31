import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save } from 'lucide-react'
import { useToast } from '../../app/toast'
import { getAuth } from '../../app/permissions'
import { recordActivity } from '../../app/activity'

function PasswordInput({ label, value, onChange }) {
  const [visible, setVisible] = useState(false)
  return <label className="password-field">{label}<div><input type={visible ? 'text' : 'password'} value={value} onChange={onChange} /><button type="button" aria-label={visible ? `Hide ${label}` : `Show ${label}`} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
}

export default function ProfilePage() {
  const toast = useToast()
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', role: '' })
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const email = getAuth()?.email
    if (!email) return
    fetch(`/api/users/by-email/${encodeURIComponent(email)}`).then(response => {
      if (!response.ok) throw new Error('Unable to load profile.')
      return response.json()
    }).then(user => setProfile({ name: user.name, email: user.email, phone: user.phone || '', role: user.role })).catch(error => toast(error.message, 'error'))
  }, [toast])

  const saveProfile = async () => {
    setSaving(true)
    try {
      const oldEmail = getAuth()?.email
      const response = await fetch(`/api/users/${encodeURIComponent(oldEmail)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to update profile.')
      const auth = getAuth()
      localStorage.setItem('laporkita-auth', JSON.stringify({ ...auth, email: profile.email, name: profile.name }))
      window.dispatchEvent(new Event('laporkita-auth-updated'))
      recordActivity(`Updated own profile: ${profile.name} (${profile.email})`)
      toast('Profile updated successfully.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  const changePassword = async () => {
    if (!oldPassword) return toast('Enter your current password first.', 'error')
    if (newPassword.length < 6) return toast('The new password must be at least 6 characters.', 'error')
    if (newPassword !== confirmPassword) return toast('The new password confirmation does not match.', 'error')
    setSaving(true)
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(getAuth()?.email)}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current_password: oldPassword, new_password: newPassword }) })
      if (!response.ok) throw new Error((await response.json()).detail || 'Unable to change password.')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      recordActivity('Changed own password')
      toast('Password changed successfully.')
    } catch (error) { toast(error.message, 'error') }
    finally { setSaving(false) }
  }
  const change = (key, value) => setProfile(previous => ({ ...previous, [key]: value }))

  return <div className="profile-page profile-grid"><section className="panel profile-card"><div className="profile-heading"><div><h2>Edit Profile</h2><p>Update your account information.</p></div></div><div className="profile-form"><label>Full Name<input value={profile.name} onChange={event => change('name', event.target.value)} /></label><label>Email<input type="email" value={profile.email} onChange={event => change('email', event.target.value)} /></label><label>Phone Number<input value={profile.phone} onChange={event => change('phone', event.target.value)} placeholder="Enter phone number" /></label></div><button className="primary-btn" disabled={saving} onClick={saveProfile}><Save size={16} /> Save Profile</button></section><section className="panel profile-card"><div className="profile-heading"><div><h2>Change Password</h2><p>Enter your current password before creating a new password.</p></div></div><div className="profile-form"><PasswordInput label="Current Password" value={oldPassword} onChange={event => setOldPassword(event.target.value)} /><PasswordInput label="New Password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /><PasswordInput label="Confirm New Password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div><button className="primary-btn" disabled={saving} onClick={changePassword}><Save size={16} /> Change Password</button></section></div>
}
