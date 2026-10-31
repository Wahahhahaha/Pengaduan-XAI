import { useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
export default function Modal({ title, children, onClose, footer }) { const [closing, setClosing] = useState(false); const close = () => { setClosing(true); setTimeout(onClose, 180) }; const content = <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onClick={close}><div className={`modal-card ${closing ? 'closing' : ''}`} onClick={event => event.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close modal" onClick={close}><X size={17} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer">{footer}</div>}</div></div>; return createPortal(content, document.body) }
