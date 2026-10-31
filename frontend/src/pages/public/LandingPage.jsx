import { useEffect, useState } from 'react'
import { ArrowRight, BrainCircuit, CheckCircle2, ChevronDown, ClipboardCheck, FileText, Menu, PencilLine, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import useWebsiteSettings from '../../hooks/useWebsiteSettings'

const features = [
  { icon: FileText, title: 'Easy Reporting', text: 'Submit complaints and feedback through a simple form with supporting evidence.' },
  { icon: ClipboardCheck, title: 'Transparent Tracking', text: 'Track complaint progress and status through a structured resolution history.' },
  { icon: BrainCircuit, title: 'Explainable AI Analysis', text: 'AI helps officers understand priorities and the reasons behind each recommendation.' },
]
const steps = [
  { icon: PencilLine, title: 'Submit a Complaint', text: 'Complete the report and attach supporting evidence.' },
  { icon: ShieldCheck, title: 'Report Verification', text: 'Officers review and validate the report.' },
  { icon: BrainCircuit, title: 'Analysis & Resolution', text: 'AI suggests a priority while officers decide the next action.' },
  { icon: CheckCircle2, title: 'Track Resolution', text: 'Follow the process until the complaint is completed.' },
]
const faqs = [
  ['How do I submit a complaint?', 'Sign in as a citizen, complete the complaint form, and attach supporting evidence if available.'],
  ['Do I need an account?', 'Yes. An account lets you privately track your complaint history and status.'],
  ['What does Explainable AI do?', 'AI provides a priority recommendation and the factors behind it for officers to review.'],
  ['Does AI make the final decision?', 'No. The final decision remains with the authorized officer.'],
]

function ScrollLink({ href, children }) {
  return <a href={href} onClick={event => { event.preventDefault(); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }) }}>{children}</a>
}

export default function LandingPage() {
  const settings = useWebsiteSettings()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [faq, setFaq] = useState(null)
  const closeMenu = () => setMobileOpen(false)
  useEffect(() => {
    const sections = document.querySelectorAll('.public-landing > section')
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) } }), { threshold: 0.12, rootMargin: '0px 0px -40px' })
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return <div className="public-landing">
    <nav className="landing-nav">
      <a className="landing-brand" href="#home"><span className="landing-logo">{settings.logo ? <img src={settings.logo} alt="Logo" /> : <Sparkles size={20} />}</span><strong>{settings.website_name}</strong></a>
      <div className={`landing-links ${mobileOpen ? 'open' : ''}`}>
        <ScrollLink href="#home">Home</ScrollLink>
        <ScrollLink href="#features">Features</ScrollLink>
        <ScrollLink href="#how-it-works">How It Works</ScrollLink>
        <ScrollLink href="#about">About</ScrollLink>
        <ScrollLink href="#faq">FAQ</ScrollLink>
        <div className="mobile-nav-actions"><Link to="/login" onClick={closeMenu}>Sign In</Link><Link className="primary-btn" to="/login" onClick={closeMenu}>Submit a Complaint</Link></div>
      </div>
      <div className="landing-actions"><Link to="/login" className="landing-login">Sign In</Link><Link to="/login" className="primary-btn">Submit a Complaint <ArrowRight size={15} /></Link></div>
      <button className="landing-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Buka menu">{mobileOpen ? <X /> : <Menu />}</button>
    </nav>

    <section id="home" className="landing-hero"><div className="hero-copy"><h1>Your voice, a step toward <em>better public service.</em></h1><p>Submit feedback and complaints through one easy, transparent, and integrated platform. Explainable AI helps officers prioritize cases more effectively.</p><div className="hero-actions"><Link className="primary-btn" to="/login">Report an Issue <ArrowRight size={16} /></Link></div><div className="hero-trust"><span><CheckCircle2 size={16} /> Easy to use</span><span><ShieldCheck size={16} /> Transparent process</span><span><BrainCircuit size={16} /> Explainable AI</span></div></div><div className="hero-visual"><div className="mockup-card"><div className="mockup-top"><span>Complaint Details</span><Badge>In Progress</Badge></div><h3>Pothole near the school</h3><p>Infrastructure · Submitted today</p><div className="mock-progress"><i /><i /><i /><i /></div><div className="mock-ai"><Sparkles size={16} /><div><b>AI Priority Analysis</b><span>Recommendation: <strong>High</strong></span></div></div></div><div className="float-card float-one"><CheckCircle2 size={15} /><span>Report received</span></div><div className="float-card float-two"><BrainCircuit size={15} /><span>AI-assisted analysis</span></div></div></section>

    <section id="features" className="landing-section"><SectionIntro title="One platform for focused public service" text="Make it easier for citizens to report issues while helping officers manage and prioritize resolution." /><div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <div className="feature-card" key={title}><span><Icon size={21} /></span><h3>{title}</h3><p>{text}</p></div>)}</div></section>
    <section id="how-it-works" className="landing-section process-section"><SectionIntro title="How does it work?" text="It only takes a few steps to submit and track your complaint." /><div className="process-grid">{steps.map(({ icon: Icon, title, text }, index) => <div className="process-step" key={title}><div className="step-number">0{index + 1}</div><Icon size={21} /><h3>{title}</h3><p>{text}</p></div>)}</div></section>
    <section className="ai-section"><div><h2>More than a prediction—an explanation.</h2><p>Explainable AI helps officers understand the factors behind a priority recommendation before deciding how to respond.</p><ul><li><CheckCircle2 size={16} /> Priority recommendation</li><li><CheckCircle2 size={16} /> Prediction factor explanations</li><li><CheckCircle2 size={16} /> Final decision remains with officers</li></ul></div><div className="ai-mockup"><span className="mock-label">ANALYSIS ILLUSTRATION</span><h3>Pothole near the school</h3><div className="priority-row"><span>Recommended priority</span><b>High</b></div>{['Safety risk', 'Near a public facility', 'Impact on road users'].map((x, i) => <div className="factor" key={x}><span>{x}</span><i style={{ width: `${90 - i * 16}%` }} /></div>)}<small>Illustrative explanation, not an operational prediction.</small></div></section>
    <section className="landing-section tracking-section"><SectionIntro title="Every report follows a clear process" text="Track your report through easy-to-understand resolution stages." /><div className="tracking-card">{['Submitted', 'Verified', 'Assigned', 'In Progress', 'Completed'].map((stage, i) => <div className={`tracking-stage ${i === 0 ? 'current' : ''}`} key={stage}><span>{i + 1}</span><b>{stage}</b>{i < 4 && <i />}</div>)}</div></section>
    <section id="about" className="landing-section about-section"><div><h2>Building a more responsive public service.</h2></div><p>{settings.website_name} connects citizens with service officers through accessible reporting, transparent tracking, better complaint organization, and responsible AI.</p></section>
    <section id="faq" className="landing-section faq-section"><SectionIntro title="Frequently asked questions" text="Quick answers about using this platform." /><div className="faq-list">{faqs.map(([question, answer], index) => <div className={`faq-item ${faq === index ? 'open' : ''}`} key={question}><button onClick={() => setFaq(faq === index ? null : index)}><span>{question}</span><ChevronDown size={17} /></button>{faq === index && <p>{answer}</p>}</div>)}</div></section>
    <section className="landing-cta"><div><h2>Have a complaint or suggestion? Share it today.</h2><p>Every piece of feedback is a step toward better public service.</p></div><Link to="/login">Submit a Complaint <ArrowRight size={16} /></Link></section>
    <footer className="landing-footer"><div><a className="landing-brand" href="#home"><span className="landing-logo">{settings.logo ? <img src={settings.logo} alt="Logo" /> : <Sparkles size={20} />}</span><strong>{settings.website_name}</strong></a><p>A transparent and accessible public complaint platform.</p></div><div><b>Navigation</b><ScrollLink href="#features">Features</ScrollLink><ScrollLink href="#how-it-works">How It Works</ScrollLink><ScrollLink href="#faq">FAQ</ScrollLink></div><div><b>Services</b><Link to="/login">Submit a Complaint</Link><Link to="/login">Sign In</Link><Link to="/citizen/dashboard">Citizen Dashboard</Link></div><div><b>Contact</b><span>Contact information is available in website settings.</span></div><small className="footer-bottom">© {new Date().getFullYear()} — {settings.website_name}. All rights reserved.</small></footer>
  </div>
}

function SectionIntro({ title, text }) { return <div className="section-intro"><h2>{title}</h2><p>{text}</p></div> }
function Badge({ children }) { return <span className="mock-badge">{children}</span> }
