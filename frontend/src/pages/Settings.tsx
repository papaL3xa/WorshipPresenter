import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Loader2, CheckCircle, ShieldAlert } from 'lucide-react';
import { callApi } from '../api';

export default function Settings() {
  const navigate = useNavigate();
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newOperatorPin, setNewOperatorPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSave = async () => {
    if (!currentAdminPin) {
      setIsError(true);
      setMessage('PIN Admin saat ini harus diisi!');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    try {
      const res = await callApi('updatePins', {}, {
        method: 'POST',
        payload: {
          adminPin: currentAdminPin,
          newOperatorPin: newOperatorPin || undefined,
          newAdminPin: newAdminPin || undefined
        }
      });
      
      if (res && res.success) {
        setIsError(false);
        setMessage('PIN berhasil diperbarui!');
        setCurrentAdminPin('');
        setNewOperatorPin('');
        setNewAdminPin('');
      } else {
        throw new Error(res.error?.message || 'Gagal mengubah PIN.');
      }
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex justify-center items-center relative overflow-hidden">
      <div className="absolute inset-0 bg-white/20 pointer-events-none -z-10 backdrop-blur-[2px]"></div>

      <div className="glass-panel max-w-2xl w-full p-6 md:p-10 shadow-2xl border-white/50 relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/30 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="glass-button text-indigo-900 p-2.5 rounded-full hover:bg-white/70 shadow-sm"><ArrowLeft size={20}/></button>
            <h1 className="text-3xl font-heading font-extrabold text-indigo-950 drop-shadow-sm tracking-tight">Pengaturan Keamanan</h1>
          </div>
          <button 
            onClick={handleSave} 
            disabled={isLoading || !currentAdminPin}
            className="glass-button bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-transparent hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
            Simpan Perubahan
          </button>
        </header>

        {message && (
          <div className={`p-4 rounded-xl mb-8 flex items-center gap-3 backdrop-blur-md shadow-sm border animate-fade-in ${isError ? 'bg-red-50/80 text-red-700 border-red-200' : 'bg-emerald-50/80 text-emerald-700 border-emerald-200'}`}>
            {isError ? <ShieldAlert size={24} className="shrink-0" /> : <CheckCircle size={24} className="shrink-0" />}
            <span className="font-semibold">{message}</span>
          </div>
        )}

        <div className="space-y-8">
          <div className="bg-white/40 p-8 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 transition-colors">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none group-hover:bg-indigo-500/20 transition-colors"></div>
            
            <h2 className="text-xl font-heading font-bold text-indigo-950 mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Lock size={20} /></div>
              Otorisasi Admin
            </h2>
            <div className="relative z-10">
              <label className="block text-slate-700 font-semibold mb-2">PIN Admin Saat Ini <span className="text-red-500">*</span></label>
              <input 
                type="password" 
                value={currentAdminPin}
                onChange={(e) => setCurrentAdminPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="w-full max-w-xs bg-white/70 backdrop-blur-sm border-2 border-white/60 rounded-xl px-4 py-3 text-2xl tracking-[0.3em] font-bold shadow-inner focus:border-indigo-400 focus:bg-white/90 focus:ring-4 focus:ring-indigo-400/20 transition-all outline-none text-indigo-950" 
                placeholder="••••••" 
              />
              <p className="text-sm font-medium text-slate-500 mt-3">Anda harus memasukkan PIN Admin yang aktif saat ini untuk memvalidasi dan menyimpan perubahan.</p>
            </div>
          </div>
          
          <div className="bg-white/40 p-8 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 transition-colors">
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-indigo-400/10 rounded-full blur-3xl -mr-10 -mb-10 pointer-events-none group-hover:bg-indigo-400/20 transition-colors"></div>
            
            <h2 className="text-xl font-heading font-bold text-indigo-950 mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><ShieldAlert size={20} /></div>
              Ubah PIN Baru
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="bg-white/30 p-5 rounded-xl border border-white/40 shadow-inner">
                <label className="block text-slate-700 font-semibold mb-3">PIN Operator Baru</label>
                <input 
                  type="password" 
                  value={newOperatorPin}
                  onChange={(e) => setNewOperatorPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="w-full bg-white/70 backdrop-blur-sm border-2 border-white/60 rounded-xl px-4 py-3 text-2xl tracking-[0.3em] font-bold shadow-inner focus:border-indigo-400 focus:bg-white/90 focus:ring-4 focus:ring-indigo-400/20 transition-all outline-none text-indigo-950" 
                  placeholder="••••••" 
                />
                <p className="text-sm font-medium text-slate-500 mt-3">Kosongkan jika tidak ingin mengubah PIN Operator.</p>
              </div>

              <div className="bg-white/30 p-5 rounded-xl border border-white/40 shadow-inner">
                <label className="block text-slate-700 font-semibold mb-3">PIN Admin Baru</label>
                <input 
                  type="password" 
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="w-full bg-white/70 backdrop-blur-sm border-2 border-white/60 rounded-xl px-4 py-3 text-2xl tracking-[0.3em] font-bold shadow-inner focus:border-indigo-400 focus:bg-white/90 focus:ring-4 focus:ring-indigo-400/20 transition-all outline-none text-indigo-950" 
                  placeholder="••••••" 
                />
                <p className="text-sm font-medium text-slate-500 mt-3">Kosongkan jika tidak ingin mengubah PIN Admin.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
