import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileClock, LayoutDashboard, LogOut, Plus, UserRound } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import useWebsiteSettings from '../hooks/useWebsiteSettings'
import { recordActivity } from '../app/activity'

export default function CitizenLayout() {
  const navigate = useNavigate(); const location = useLocation(); const outlet = useOutlet(); const settings = useWebsiteSettings(); const [profileOpen, setProfileOpen] = useState(false); const firstRender = useRef(true); const [displayedOutlet, setDisplayedOutlet] = useState(outlet); const [phase, setPhase] = useState('enter')
  useEffect(() => { if (firstRender.current) { firstRender.current = false; return undefined } setPhase('exit'); const timer = window.setTimeout(() => { setDisplayedOutlet(outlet); setPhase('enter') }, 160); return () => window.clearTimeout(timer) }, [location.key])
  const auth = JSON.parse(localStorage.getItem('laporkita-auth') || '{}')
  const name = auth.name || auth.email || ''
  const logout = () => { recordActivity('Logged out'); localStorage.removeItem('laporkita-auth'); navigate('/login', { replace: true }) }
  return <div className="citizen-shell"><header className="citizen-navbar"><Link className="citizen-brand" to="/citizen/dashboard"><span className="citizen-brand-mark">{settings.logo ? <img src={settings.logo} alt={`Logo ${settings.website_name}`} /> : '◉'}</span><strong>{settings.website_name}</strong></Link><nav className="citizen-nav-links"><NavLink to="/citizen/dashboard"><LayoutDashboard size={16} /> Dashboard</NavLink><NavLink to="/citizen/complaints"><FileClock size={16} /> Complaint History</NavLink><NavLink to="/citizen/complaints/new" className="citizen-new-link"><Plus size={16} /> New Complaint</NavLink></nav><div className="citizen-profile-menu"><button className="citizen-profile-trigger" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span><b>{name}</b><small>Citizen</small></span><ChevronDown size={16} /></button>{profileOpen && <div className="citizen-profile-dropdown"><button onClick={() => { setProfileOpen(false); navigate('/citizen/profile') }}><UserRound size={16} /> Profile</button><button onClick={logout}><LogOut size={16} /> Logout</button></div>}</div></header><main className="citizen-main"><div className="content"><div className={`page-transition ${phase}`}>{displayedOutlet}</div></div></main></div>
}
