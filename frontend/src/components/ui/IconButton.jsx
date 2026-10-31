export default function IconButton({ label, children, onClick }) { return <button className="icon-btn" aria-label={label} title={label} onClick={onClick}>{children}</button> }
