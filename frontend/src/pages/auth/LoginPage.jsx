import { useState } from 'react'
import { ClipboardCheck, Eye, EyeOff, ShieldCheck, UserRound, Users } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../../app/toast'
import useWebsiteSettings from '../../hooks/useWebsiteSettings'
import { recordActivity } from '../../app/activity'
import './LoginPage.css'

const presets = {
  superadmin: { label: 'Superadmin', email: 'superadmin@local.test', password: 'development-password', icon: ShieldCheck },
  admin: { label: 'Admin', email: 'admin@local.test', password: 'development-password', icon: UserRound },
  officer: { label: 'Officer', email: 'petugas@local.test', password: 'development-password', icon: ClipboardCheck },
  citizen: { label: 'Citizen', email: 'warga@local.test', password: 'development-password', icon: Users },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const settings = useWebsiteSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (localStorage.getItem('laporkita-auth')) return <Navigate to={location.state?.from || '/admin/dashboard'} replace />

  const fillPreset = role => {
    const preset = presets[role]
    setEmail(preset.email)
    setPassword(preset.password)
    toast(`${preset.label} is ready.`)
  }

  const signIn = async event => {
    event.preventDefault()
    if (!email || !password) return toast('Email and password are required.', 'error')
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) })
      if (!response.ok) throw new Error('Invalid email or password.')
      const user = await response.json()
      localStorage.setItem('laporkita-auth', JSON.stringify({ email: user.email, name: user.name, role: user.role_key, role_id: user.role_id }))
      recordActivity(`Logged in as ${user.role} (${user.email})`)
      toast('Login successful. Welcome!')
      navigate(user.role_key === 'citizen' ? '/citizen/dashboard' : '/admin/dashboard', { replace: true })
    } catch (error) { toast(error.message || 'Unable to sign in.', 'error') }
  }

  return <div className="auth-page"><header className="auth-navbar"><Link className="auth-navbar-brand" to="/" aria-label={`${settings.website_name} home`}>{settings.logo && <img src={settings.logo} alt="" />}{settings.website_name && <span>{settings.website_name}</span>}</Link></header><div className="auth-card"><div className="auth-brand-mark">{settings.logo && <img src={settings.logo} alt={`Logo ${settings.website_name}`} />}</div><h1>Sign in to {settings.website_name}</h1><p>Manage public complaints with ease.</p><div className="quick-login"><span>Development quick login</span><div>{Object.entries(presets).map(([role, preset]) => { const Icon = preset.icon; return <button type="button" key={role} onClick={() => fillPreset(role)}><Icon size={14} />{preset.label}</button> })}</div></div><form onSubmit={signIn}><label>Email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@institution.gov" /></label><label>Password<div className="password-field"><input type={showPassword ? 'text' : 'password'} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><button className="primary-btn" type="submit">Sign In</button></form><div className="auth-switch">Don&apos;t have an account? <Link to="/register">Register</Link></div></div></div>
}
