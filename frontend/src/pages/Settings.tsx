import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Loader2, CheckCircle, ShieldAlert, Download, Upload, Database } from 'lucide-react';
import { callApi } from '../api';
import { exportCustomSongsJson, exportPlaylistsJson, exportAllJson, importBackupTsv } from '../utils/backupRestore';
import { FooterClock } from '../components/FooterClock';

export default function Settings() {
  const navigate = useNavigate();
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newOperatorPin, setNewOperatorPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI;
  const [activeTab, setActiveTab] = useState<'security' | 'backup'>(isDesktop ? 'backup' : 'security');
  
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
    <div className="min-h-screen p-4 md:p-8 flex flex-col justify-between items-center relative overflow-hidden">
      <div className="absolute inset-0 bg-white/20 pointer-events-none -z-10 backdrop-blur-[2px]"></div>

      <div className="glass-panel max-w-2xl w-full p-6 md:p-10 shadow-2xl border-white/50 relative z-10 my-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-white/30 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="glass-button text-indigo-900 p-2.5 rounded-full hover:bg-white/70 shadow-sm"><ArrowLeft size={20}/></button>
            <h1 className="text-3xl font-heading font-extrabold text-indigo-950 drop-shadow-sm tracking-tight">Pengaturan Keamanan</h1>
          </div>
          {activeTab === 'security' && !isDesktop && (
            <button 
              onClick={handleSave} 
              disabled={isLoading || !currentAdminPin}
              className="glass-button bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border-transparent hover:from-indigo-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
              Simpan Perubahan
            </button>
          )}
        </header>

        {message && (
          <div className={`p-4 rounded-xl mb-8 flex items-center gap-3 backdrop-blur-md shadow-sm border animate-fade-in ${isError ? 'bg-red-50/80 text-red-700 border-red-200' : 'bg-emerald-50/80 text-emerald-700 border-emerald-200'}`}>
            {isError ? <ShieldAlert size={24} className="shrink-0" /> : <CheckCircle size={24} className="shrink-0" />}
            <span className="font-semibold">{message}</span>
          </div>
        )}
        
        <div className="flex gap-4 mb-8">
          {!isDesktop && (
            <button 
              onClick={() => setActiveTab('security')}
              className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/40 text-indigo-900 hover:bg-white/60'}`}
            >
              Keamanan (PIN)
            </button>
          )}
          <button 
            onClick={() => setActiveTab('backup')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'backup' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/40 text-indigo-900 hover:bg-white/60'}`}
          >
            Backup & Restore
          </button>
        </div>

        {activeTab === 'security' && (
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
        )}
        
        {activeTab === 'backup' && (
        <div className="space-y-8">
          <div className="bg-white/40 p-8 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 transition-colors">
            <h2 className="text-xl font-heading font-bold text-indigo-950 mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Download size={20} /></div>
              Ekspor (Download Backup)
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  await exportAllJson();
                  setIsLoading(false);
                }}
                className="flex-1 glass-button bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 border-emerald-200 flex flex-col items-center gap-3 p-6 rounded-xl"
              >
                <Database size={32} />
                <span className="font-bold">Backup Semua (.json)</span>
                <span className="text-xs opacity-70">Lagu Kustom + Playlist</span>
              </button>
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  await exportCustomSongsJson();
                  setIsLoading(false);
                }}
                className="flex-1 glass-button bg-indigo-500/10 text-indigo-800 hover:bg-indigo-500/20 border-indigo-200 flex flex-col items-center gap-3 p-6 rounded-xl"
              >
                <Database size={32} />
                <span className="font-bold">Backup Lagu Kustom (.json)</span>
              </button>
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  await exportPlaylistsJson();
                  setIsLoading(false);
                }}
                className="flex-1 glass-button bg-purple-500/10 text-purple-800 hover:bg-purple-500/20 border-purple-200 flex flex-col items-center gap-3 p-6 rounded-xl"
              >
                <Database size={32} />
                <span className="font-bold">Backup Playlist (.json)</span>
              </button>
            </div>
          </div>
          
          <div className="bg-white/40 p-8 rounded-2xl border border-white/60 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 transition-colors">
            <h2 className="text-xl font-heading font-bold text-indigo-950 mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Upload size={20} /></div>
              Impor (Restore Backup)
            </h2>
            <div className="relative z-10">
              <p className="text-sm font-medium text-slate-600 mb-4">Unggah file <strong>.json</strong> hasil backup Anda. Lagu Kustom dan Playlist akan otomatis dikenali dan ditambahkan. File <strong>.tsv</strong> lama juga tetap didukung.</p>
              <input 
                type="file"
                accept=".json,.tsv"
                onChange={async (e) => {
                  if (!e.target.files || e.target.files.length === 0) return;
                  const file = e.target.files[0];
                  setIsLoading(true);
                  setMessage('');
                  try {
                    const resultMsg = await importBackupTsv(file);
                    setIsError(false);
                    setMessage(resultMsg);
                  } catch (err: any) {
                    setIsError(true);
                    setMessage(err);
                  } finally {
                    setIsLoading(false);
                    e.target.value = ''; // reset
                  }
                }}
                className="w-full text-sm text-indigo-900 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer border-2 border-dashed border-emerald-200 p-4 rounded-xl bg-white/50"
              />
            </div>
          </div>
        </div>
        )}
      </div>
      <FooterClock />
    </div>
  );
}
