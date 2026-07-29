import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, MonitorPlay, Loader2 } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #667eea 0%, transparent 50%)',
          backgroundSize: '100% 100%'
        }}
      ></div>
      
      <div className={`glass-panel p-8 w-full max-w-md z-10 transition-transform duration-300 ${errorMsg ? 'animate-bounce' : ''}`}>
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/40 mb-4 text-white">
            <MonitorPlay size={32} />
          </div>
          <h1 className="text-2xl font-bold text-indigo-900">Worship Presenter</h1>
          <p className="text-indigo-900/60 text-sm mt-1">Masukkan PIN Operator untuk melanjutkan</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-indigo-400" />
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className={`glass-input pl-11 py-4 text-center text-2xl tracking-[0.5em] font-bold ${errorMsg ? 'border-red-500 ring-2 ring-red-500/50 focus:ring-red-500 bg-red-50/50' : 'text-indigo-900'}`}
                placeholder="••••••"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                disabled={isLoading}
                autoFocus
              />
            </div>
            {errorMsg && <p className="text-red-500 text-sm text-center mt-2 font-semibold">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || !pin}
            className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
            {isLoading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>
        
        <div className="mt-8 text-center text-xs text-indigo-900/40">
          Kode PIN Default: 123456
        </div>
      </div>
    </div>
  );
}
