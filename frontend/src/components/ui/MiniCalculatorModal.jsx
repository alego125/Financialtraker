import { useState } from 'react';
import Modal from './Modal';

// Recursive-descent parser for +,-,*,/,(),. only — intentionally not eval()/Function()
// to avoid executing arbitrary input.
export function evaluateExpression(input) {
  const expr = String(input).replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!expr) return null;
  if (!/^[0-9+\-*/().]+$/.test(expr)) throw new Error('Expresión inválida');

  let pos = 0;
  const peek = () => expr[pos];
  const isDigit = c => c >= '0' && c <= '9';

  function parseNumber() {
    const start = pos;
    while (pos < expr.length && (isDigit(peek()) || peek() === '.')) pos++;
    if (start === pos) throw new Error('Número esperado');
    return parseFloat(expr.slice(start, pos));
  }
  function parseFactor() {
    if (peek() === '-') { pos++; return -parseFactor(); }
    if (peek() === '+') { pos++; return parseFactor(); }
    if (peek() === '(') {
      pos++;
      const val = parseExpr();
      if (peek() !== ')') throw new Error('Falta cerrar paréntesis');
      pos++;
      return val;
    }
    return parseNumber();
  }
  function parseTerm() {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = peek(); pos++;
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : val / rhs;
    }
    return val;
  }
  function parseExpr() {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek(); pos++;
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }

  const result = parseExpr();
  if (pos !== expr.length) throw new Error('Expresión inválida');
  if (!isFinite(result)) throw new Error('Resultado inválido');
  return result;
}

const KEYS = [
  ['7','8','9','÷'],
  ['4','5','6','×'],
  ['1','2','3','-'],
  ['0','.','⌫','+'],
];

export default function MiniCalculatorModal({ open, onClose, onUseResult }) {
  const [expr, setExpr]   = useState('');
  const [error, setError] = useState('');

  const press = (key) => {
    setError('');
    if (key === '⌫') { setExpr(e => e.slice(0, -1)); return; }
    setExpr(e => e + key);
  };

  const clear = () => { setExpr(''); setError(''); };

  const currentResult = (() => {
    try { return evaluateExpression(expr); } catch { return null; }
  })();

  const handleUse = () => {
    try {
      const result = evaluateExpression(expr);
      if (result === null) return;
      onUseResult(result);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Calculadora" size="sm">
      <div className="space-y-3">
        <div className="bg-surface3 rounded-xl p-3 text-right">
          <div className="text-xs text-[var(--subtle)] font-mono min-h-4 truncate">{expr || '0'}</div>
          <div className="text-xl font-mono font-bold text-[var(--text)] min-h-7">
            {currentResult !== null ? currentResult : '—'}
          </div>
        </div>
        {error && <div className="text-xs text-expense">{error}</div>}
        <div className="grid grid-cols-4 gap-2">
          {KEYS.flat().map(k => (
            <button key={k} type="button" onClick={() => press(k)}
              className="btn-secondary py-2.5 text-sm font-mono">{k}</button>
          ))}
          <button type="button" onClick={() => press('(')} className="btn-secondary py-2.5 text-sm font-mono">(</button>
          <button type="button" onClick={() => press(')')} className="btn-secondary py-2.5 text-sm font-mono">)</button>
          <button type="button" onClick={clear} className="btn-danger py-2.5 text-sm col-span-2">C</button>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cerrar</button>
          <button type="button" onClick={handleUse} disabled={currentResult === null} className="btn-primary flex-1 disabled:opacity-50">
            Usar este resultado
          </button>
        </div>
      </div>
    </Modal>
  );
}
