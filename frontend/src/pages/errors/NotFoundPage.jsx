import { Link, useLocation } from 'react-router-dom'
import LandingPage from '../public/LandingPage?clean=landing-labels'
import ProfilePage from '../common/ProfilePage'
import BackupPage from '../system/BackupPage'

export default function NotFoundPage() {
  const location = useLocation()
  if (location.pathname === '/') return <LandingPage />
  if (location.pathname === '/admin/profile') return <ProfilePage />
  if (location.pathname === '/admin/system/backup') return <BackupPage />
  const code = location.pathname === '/500' ? '500' : location.pathname === '/501' ? '501' : location.pathname === '/419' ? '419' : '404'
  const content = { '404': ['PAGE NOT FOUND', 'Halaman tidak ditemukan', 'URL yang Anda buka tidak tersedia.'], '419': ['SESSION EXPIRED', 'Sesi telah berakhir', 'Silakan kembali ke halaman login untuk melanjutkan.'], '500': ['SERVER ERROR', 'Terjadi kesalahan server', 'Sistem sedang mengalami kendala. Silakan coba lagi nanti.'], '501': ['NOT AVAILABLE', 'Fitur belum tersedia', 'Fitur ini belum tersedia pada versi aplikasi saat ini.'] }[code]
  return <div className="error-page"><div className="error-card"><div className="error-icon">{code}</div><span className="error-eyebrow">{content[0]}</span><h1>{content[1]}</h1><p>{content[2]}</p><Link className="primary-btn" to={code === '419' ? '/login' : '/'}>{code === '419' ? 'Kembali ke Login' : 'Kembali ke Beranda'}</Link></div></div>
}
