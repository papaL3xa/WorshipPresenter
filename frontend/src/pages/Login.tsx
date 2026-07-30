import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, MonitorPlay, Loader2 } from 'lucide-react';
import { callApi } from '../api';

export default function Login() {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const res = await callApi('verifyLogin', {}, { 
        method: 'POST', 
        payload: { pin } 
      });
      if (res && res.success && res.data && res.data.role) {
        localStorage.setItem('worship_is_logged_in', 'true');
        localStorage.setItem('worship_role', res.data.role); // 'admin' atau 'operator'
        navigate('/dashboard');
      } else {
        throw new Error(res.error?.message || "Gagal login, respon tidak valid dari server.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "PIN salah atau jaringan bermasalah.");
      setPin('');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.2) 0%, transparent 40%), radial-gradient(circle at bottom left, rgba(236, 72, 153, 0.2) 0%, transparent 40%)',
          backgroundSize: '100% 100%'
        }}
      ></div>
      
      <div className={`glass-panel bg-white/20 p-8 w-full max-w-md z-10 transition-all duration-300 shadow-2xl border-white/40 ${errorMsg ? 'animate-bounce border-red-400 ring-2 ring-red-400/50' : ''}`}>
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-600/40 mb-6 text-white border-4 border-white/20">
            <MonitorPlay size={40} className="drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-heading font-extrabold text-indigo-950 tracking-tight drop-shadow-sm text-center">Worship Presenter</h1>
          <p className="text-slate-700 font-medium text-sm mt-3 text-center bg-white/30 px-4 py-1.5 rounded-full border border-white/40 shadow-sm">Masukkan PIN Operator untuk melanjutkan</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-6">
          <div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Lock className={`h-6 w-6 transition-colors ${errorMsg ? 'text-red-500' : 'text-slate-800'}`} />
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className={`w-full bg-white/60 backdrop-blur-sm border-2 rounded-2xl pl-14 py-5 text-center text-3xl tracking-[0.5em] font-bold shadow-inner transition-all duration-300 outline-none placeholder-slate-600 ${errorMsg ? 'border-red-400 text-red-700 bg-red-50/50 focus:ring-4 focus:ring-red-400/20' : 'border-white/60 text-black focus:border-indigo-400 focus:bg-white/90 focus:ring-4 focus:ring-indigo-400/20'}`}
                placeholder="••••••"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isLoading}
                autoFocus
              />
            </div>
            {errorMsg && <p className="text-red-600 text-sm text-center mt-3 font-semibold bg-red-100/80 backdrop-blur-sm py-2 rounded-lg border border-red-200">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || pin.length < 4}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all duration-300 transform active:scale-95 shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : null}
            <span>{isLoading ? 'Memeriksa...' : 'Masuk Sekarang'}</span>
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <span className="text-xs font-semibold text-slate-600 bg-white/40 px-3 py-1.5 rounded-full border border-white/50 shadow-sm">
            Kode PIN Default: <strong className="text-indigo-800">123456</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
