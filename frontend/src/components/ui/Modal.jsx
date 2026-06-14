// src/components/ui/Modal.jsx
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: width }}>
        <div className="modal-header">
          <h2 className="text-h3">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
