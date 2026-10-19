import { createPortal } from 'react-dom';
import { useEffect, useId, useRef } from 'react';

const modalStack = [];
let previousOverflow = '';
const focusables = node => [...node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
  .filter(el => !el.disabled && !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length);
const syncStack = () => modalStack.forEach((entry, index) => {
  entry.node.inert = index !== modalStack.length - 1;
  entry.node.setAttribute('aria-modal', String(index === modalStack.length - 1));
  entry.node.parentElement.style.zIndex = String(50 + index);
});

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!modalStack.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    const entry = { node };
    modalStack.push(entry); syncStack();
    (focusables(node)[0] || node).focus();
    const keydown = event => {
      if (modalStack.at(-1) !== entry) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current?.(); }
      if (event.key === 'Tab') {
        const items = focusables(node), first = items[0], last = items.at(-1);
        if (!items.length) { event.preventDefault(); node.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const focusin = event => { if (modalStack.at(-1) === entry && !node.contains(event.target)) (focusables(node)[0] || node).focus(); };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      const wasTop = modalStack.at(-1) === entry;
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      syncStack();
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      if (!modalStack.length) document.body.style.overflow = previousOverflow;
      if (wasTop) {
        const top = modalStack.at(-1)?.node;
        if (previousFocus?.isConnected && (!top || top.contains(previousFocus))) previousFocus.focus();
        else if (top) (focusables(top)[0] || top).focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const maxW = { sm: '420px', md: '520px', lg: '680px', xl: '900px' }[size] || '520px';

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget && modalStack.at(-1)?.node === dialogRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'var(--overlay)',
        backdropFilter: 'blur(4px)',
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: maxW,
          background: 'var(--surface2)',
          border: '1.5px solid var(--border)',
          borderRadius: '16px',
          boxShadow: 'var(--card-shadow2)',
          maxHeight: 'calc(100dvh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          margin: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', gap: '12px', borderBottom: '1.5px solid var(--border)', flexShrink: 0,
        }}>
          <h2 id={titleId} style={{
            fontSize: '1rem', fontFamily: 'DM Sans, sans-serif',
            fontWeight: 700, color: 'var(--text)', margin: 0, minWidth: 0, flex: 1, overflowWrap: 'anywhere',
          }}>{title}</h2>
          <button type="button" aria-label="Cerrar diálogo" onClick={onClose} style={{
            width: '44px', height: '44px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface3)', border: '1px solid var(--border2)',
            color: 'var(--muted)', cursor: 'pointer', fontSize: '0.9rem',
            transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border2)'; }}
          >✕</button>
        </div>
        {/* Scrollable body */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, minHeight: 0, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
