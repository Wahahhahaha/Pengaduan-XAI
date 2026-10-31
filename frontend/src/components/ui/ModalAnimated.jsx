import { useState } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function ModalAnimated({ title, children, onClose, footer }) {
  const [closing, setClosing] = useState(false)
  const close = () => { if (closing) return; setClosing(true); window.setTimeout(onClose, 240) }
  const content = <div className={`modal-backdrop ${closing ? 'closing' : ''}`} onClick={close}><div className={`modal-card ${closing ? 'closing' : ''}`} onClick={event => event.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Close modal" onClick={close}><X size={17} /></button></div><div className="modal-body">{children}</div>{footer && <div className="modal-footer" onClickCapture={event => { if (event.target.closest('.outline-btn')) { event.preventDefault(); event.stopPropagation(); close() } }}>{footer}</div>}</div></div>
  return createPortal(content, document.body)
}
