import { createContext, useContext, useState, useEffect } from 'react';
import api, { setCsrfToken } from '../services/api';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const clear = () => { setUser(null); setCsrfToken(null); };
  useEffect(() => {
    localStorage.removeItem('token'); localStorage.removeItem('user');
    const abort = new AbortController();
    api.get('/auth/me', { signal: abort.signal }).then(({ data }) => { const { csrfToken, ...profile } = data; setUser(profile); }).catch(err => {
      if (!abort.signal.aborted && err.response?.status !== 401) setSessionError('No se pudo comprobar la sesión. Recargá para volver a intentar.');
    }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    const changed = () => { clear(); setSessionError('La sesión cambió en otra pestaña. Recargá la página para continuar.'); };
    window.addEventListener('fintrack:session-changed', changed);
    window.addEventListener('fintrack:unauthorized', clear);
    return () => { abort.abort(); window.removeEventListener('fintrack:unauthorized', clear); window.removeEventListener('fintrack:session-changed', changed); };
  }, []);
  const login = async (email, password) => { const { data } = await api.post('/auth/login', { email, password }); setUser(data.user); return data; };
  const register = async (name, email, password) => { const { data } = await api.post('/auth/register', { name, email, password }); setUser(data.user); return data; };
  const logout = async () => { await api.post('/auth/logout'); clear(); };
  return <AuthContext.Provider value={{ user, loading, sessionError, login, register, logout, updateUser: setUser }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
