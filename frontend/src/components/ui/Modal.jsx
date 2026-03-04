import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizeMap[size]} card border-dark-400 shadow-2xl shadow-black/50 rounded-t-2xl sm:rounded-2xl max-h-[95vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500 flex-shrink-0">
          <h2 className="text-base font-display font-bold text-white">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 hover:bg-dark-500 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}