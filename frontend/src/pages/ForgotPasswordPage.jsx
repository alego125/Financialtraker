import { Link } from 'react-router-dom';
import logoUrl from '../assets/logo.png';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={logoUrl} alt="FinancialTracker" className="w-14 h-14 rounded-2xl object-cover mb-4 shadow-lg shadow-accent/30" />
          <h1 className="text-2xl font-display font-bold text-white">Olvidé mi contraseña</h1>
        </div>

        <div className="card p-5 sm:p-7 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl mx-auto mb-4">
              🔑
            </div>
            <h2 className="font-display font-bold text-white mb-2">Recuperación manual</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Para restablecer tu contraseña, enviá un email al administrador solicitando el reseteo de tu cuenta.
            </p>
          </div>

          <div className="bg-dark-700 border border-dark-400 rounded-xl p-4 space-y-2">
            <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider">Email del administrador</p>
            <a href="mailto:alejandro.gomez969@gmail.com?subject=Solicitud%20de%20reseteo%20de%20contraseña%20-%20FinancialTracker"
              className="text-accent-light font-mono text-sm hover:text-white transition-colors break-all">
              alejandro.gomez969@gmail.com
            </a>
          </div>

          <div className="bg-dark-700 border border-dark-400 rounded-xl p-4">
            <p className="text-xs font-display font-semibold text-slate-500 uppercase tracking-wider mb-2">Modelo de email</p>
            <p className="text-slate-400 text-xs leading-relaxed italic">
              "Hola, soy [tu nombre] y necesito que reseteen la contraseña de mi cuenta registrada con el email [tu email]. Gracias."
            </p>
          </div>

          <div className="pt-2 text-center border-t border-dark-500">
            <Link to="/login" className="text-accent-light hover:text-white text-sm font-medium transition-colors">
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
