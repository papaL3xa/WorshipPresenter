import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Loader2, CheckCircle, ShieldAlert, Download, Upload, Database, Monitor } from 'lucide-react';
import { callApi } from '../api';
import { exportCustomSongsJson, exportPlaylistsJson, exportAllJson, importBackupTsv } from '../utils/backupRestore';
import { FooterClock } from '../components/FooterClock';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Settings() {
  const navigate = useNavigate();
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newOperatorPin, setNewOperatorPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('worship_dark_mode') !== 'false');
  const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI;
  const [activeTab, setActiveTab] = useState<'security' | 'backup'>('backup');
  
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
    <div className="min-h-full flex flex-col p-4 md:p-8 gap-4 overflow-hidden relative">

      <header className="glass-panel p-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="glass-button text-indigo-900 dark:text-[#C5A059] p-2.5 rounded-full hover:bg-white/70 dark:hover:bg-white/10 shadow-sm"><ArrowLeft size={20}/></button>
          <h1 className="text-3xl font-heading font-extrabold text-indigo-950 dark:text-[#D4B872] drop-shadow-sm tracking-tight flex items-center gap-4">
            Pengaturan
            <FooterClock />
          </h1>
        </div>
        <div className="flex gap-4">
          <ThemeToggle />
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
        </div>
      </header>

      <main className="glass-panel w-full flex-1 p-6 md:p-10 shadow-lg relative z-10 flex flex-col overflow-y-auto mb-6">

        {message && (
          <div className={`p-4 rounded-xl mb-8 flex items-center gap-3 backdrop-blur-md shadow-sm border animate-fade-in ${isError ? 'bg-red-50/80 text-red-700 border-red-200' : 'bg-emerald-50/80 text-emerald-700 border-emerald-200'}`}>
            {isError ? <ShieldAlert size={24} className="shrink-0" /> : <CheckCircle size={24} className="shrink-0" />}
            <span className="font-semibold">{message}</span>
          </div>
        )}
        {activeTab === 'backup' && (
        <div className="space-y-8">
          <div className="bg-white/40 dark:bg-black/20 p-8 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 dark:hover:bg-black/30 transition-colors">
            <h2 className="text-xl font-heading font-bold text-indigo-950 dark:text-[#D4B872] mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-indigo-100 dark:bg-black/40 p-2 rounded-lg text-indigo-600 dark:text-[#C5A059]"><Download size={20} /></div>
              Ekspor (Download Backup)
            </h2>
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  await exportAllJson();
                  setIsLoading(false);
                }}
                className="flex-1 glass-button bg-emerald-500/10 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 flex flex-col items-center gap-3 p-6 rounded-xl"
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
                className="flex-1 glass-button bg-indigo-500/10 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 hover:bg-indigo-500/20 dark:hover:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800 flex flex-col items-center gap-3 p-6 rounded-xl"
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
                className="flex-1 glass-button bg-purple-500/10 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 hover:bg-purple-500/20 dark:hover:bg-purple-900/50 border-purple-200 dark:border-purple-800 flex flex-col items-center gap-3 p-6 rounded-xl"
              >
                <Database size={32} />
                <span className="font-bold">Backup Playlist (.json)</span>
              </button>
            </div>
          </div>
          
          <div className="bg-white/40 dark:bg-black/20 p-8 rounded-2xl border border-white/60 dark:border-white/10 shadow-sm backdrop-blur-sm relative overflow-hidden group hover:bg-white/50 dark:hover:bg-black/30 transition-colors">
            <h2 className="text-xl font-heading font-bold text-indigo-950 dark:text-[#D4B872] mb-6 flex items-center gap-3 drop-shadow-sm">
              <div className="bg-emerald-100 dark:bg-black/40 p-2 rounded-lg text-emerald-600 dark:text-emerald-400"><Upload size={20} /></div>
              Impor (Restore Backup)
            </h2>
            <div className="relative z-10">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4">Unggah file <strong>.json</strong> hasil backup Anda. Lagu Kustom dan Playlist akan otomatis dikenali dan ditambahkan. File <strong>.tsv</strong> lama juga tetap didukung.</p>
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
                className="w-full text-sm text-indigo-900 dark:text-[#D4B872] file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 dark:file:bg-emerald-900/40 file:text-emerald-800 dark:file:text-emerald-400 hover:file:bg-emerald-200 dark:hover:file:bg-emerald-900/60 cursor-pointer border-2 border-dashed border-emerald-200 dark:border-emerald-800 p-4 rounded-xl bg-white/50 dark:bg-white/5"
              />
            </div>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}
