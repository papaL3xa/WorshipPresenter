import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Folder, Search, Settings, Loader2, Trash2, HelpCircle, X, Info, Globe, Heart } from 'lucide-react';
import { SyncButton } from '../components/SyncButton';
import { callApi } from '../api';
import { FooterClock } from '../components/FooterClock';

export default function Dashboard() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [playlistToDelete, setPlaylistToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const fetchPlaylists = async () => {
    setIsLoading(true);
    try {
      const res = await callApi('getPlaylists');
      if (res.success) {
        setPlaylists(res.data);
      } else {
        setErrorMsg(res.error?.message || 'Gagal memuat jadwal.');
      }
    } catch (err: any) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    setPlaylistToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!playlistToDelete) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await callApi('deletePlaylist', {}, { method: 'POST', payload: { id: playlistToDelete.id } });
      if (res && res.success) {
        setPlaylistToDelete(null);
        fetchPlaylists();
      } else {
        setDeleteError('Gagal menghapus. Silakan coba lagi.');
      }
    } catch (err) {
      console.error(err);
      setDeleteError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    if (isDeleting) return;
    setPlaylistToDelete(null);
    setDeleteError('');
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  return (
    <div className="min-h-full flex flex-col p-4 md:p-8 gap-4 overflow-hidden relative">
      <header className="glass-panel p-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-heading font-extrabold text-indigo-950 dark:text-white drop-shadow-md tracking-tight flex items-center gap-3">
          <div className="bg-indigo-600/10 dark:bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-indigo-600/20 dark:border-white/30">
            <Play className="text-indigo-600 dark:text-white" size={24} strokeWidth={2.5}/>
          </div>
          WorshipPresenter
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
          <SyncButton />
          <button onClick={() => setIsAboutOpen(true)} className="glass-button flex items-center gap-2"><Info size={18}/> Tentang</button>
          <button onClick={() => setIsGuideOpen(true)} className="glass-button flex items-center gap-2 bg-indigo-100 text-indigo-900 border border-indigo-300 hover:bg-indigo-200"><HelpCircle size={18}/> Cara Penggunaan</button>
          <button onClick={() => navigate('/library')} className="glass-button flex items-center gap-2"><Folder size={18}/> Library</button>
          {localStorage.getItem('worship_role') === 'admin' && (
            <button onClick={() => navigate('/settings')} className="glass-button flex items-center gap-2"><Settings size={18}/> Settings</button>
          )}
        </div>
      </header>
      
      <FooterClock />
      
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto mb-6">
        <section className="glass-panel p-6 lg:col-span-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-heading font-bold text-slate-800 drop-shadow-sm">Jadwal Ibadah Mendatang</h2>
            <button onClick={() => navigate('/control?id=new')} className="glass-button bg-indigo-500/20 text-indigo-900 border-indigo-500/30 hover:bg-indigo-500/30 flex items-center gap-2">
              <Plus size={18} /> Playlist Baru
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-12 text-slate-700/60"><Loader2 className="animate-spin" size={32} /></div>
          ) : errorMsg ? (
            <div className="text-red-700 bg-red-100/80 backdrop-blur-sm p-4 rounded-xl border border-red-200 shadow-sm">{errorMsg}</div>
          ) : playlists.length === 0 ? (
            <div className="text-slate-700/60 text-center p-8 bg-white/20 rounded-2xl border border-white/30 border-dashed">Tidak ada jadwal ibadah mendatang.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playlists.map((pl) => (
                <div key={pl.id} className="p-5 rounded-2xl bg-white/30 backdrop-blur-md border border-white/40 shadow-sm hover:shadow-lg hover:bg-white/50 hover:-translate-y-1 transition-all duration-300 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group">
                  <div>
                    <h3 className="font-heading font-bold text-xl text-slate-800 mb-1">{pl.name}</h3>
                    <p className="text-sm font-medium text-slate-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                      {pl.date}
                    </p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => handleDeletePlaylist(pl.id, pl.name)} 
                      className="glass-button p-2 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                      title="Hapus Playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button onClick={() => navigate('/control?id=' + pl.id)} className="glass-button flex-1 md:flex-none justify-center bg-gradient-to-r from-emerald-400 to-emerald-600 text-white border-transparent shadow-lg hover:shadow-emerald-500/40 font-bold flex items-center gap-2">
                      <Play size={16} strokeWidth={3}/> Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        
        <section className="glass-panel p-6 lg:col-span-4 h-fit">
          <h2 className="text-xl font-heading font-bold text-slate-800 drop-shadow-sm mb-6">Pencarian Cepat</h2>
          <div className="relative">
            <Search className="absolute left-4 top-3 text-slate-500" size={20} />
            <input 
              type="text" 
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickSearch.trim() !== '') {
                  navigate(`/library?q=${encodeURIComponent(quickSearch.trim())}`);
                }
              }}
              placeholder="Cari lagu atau ayat... (Enter)" 
              className="glass-input pl-12" 
            />
          </div>
          <div className="mt-6 text-sm text-slate-600 bg-white/20 p-4 rounded-xl border border-white/30">
            <p><strong>Tips:</strong> Anda juga bisa mencari menggunakan fitur Quick Search langsung di dalam <span className="font-semibold text-indigo-700">Control Panel</span> saat mode Live.</p>
          </div>
        </section>
      </main>

      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors ${isDeleting ? 'bg-red-500' : 'bg-red-100 text-red-500'}`}>
                {isDeleting 
                  ? <Loader2 size={32} className="animate-spin text-white" />
                  : <Trash2 size={32} />}
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {isDeleting ? 'Menghapus...' : 'Hapus Playlist?'}
              </h3>
              {!isDeleting && (
                <p className="text-slate-600 mb-2">
                  Apakah Anda yakin ingin menghapus jadwal <strong className="text-slate-800">{playlistToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.
                </p>
              )}
              {isDeleting && (
                <p className="text-slate-500 mb-4 text-sm">Sedang menghapus playlist, mohon tunggu...</p>
              )}
              {deleteError && (
                <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-xl">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button 
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 shadow-md shadow-red-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeleting ? <><Loader2 size={16} className="animate-spin" /> Menghapus...</> : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <HelpCircle size={24} className="text-indigo-600" /> 
                Buku Panduan Pengguna
              </h2>
              <button 
                onClick={() => setIsGuideOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 overflow-hidden relative">
              <iframe 
                src="Panduan_Pengguna.html" 
                className="w-full h-full border-none absolute inset-0 bg-white" 
                title="Panduan Pengguna"
              />
            </div>
          </div>
        </div>
      )}

      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-indigo-100 relative">
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800"></div>
            
            <button 
              onClick={() => setIsAboutOpen(false)} 
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full transition-all z-10"
            >
              <X size={20} />
            </button>
            
            <div className="relative pt-16 px-8 pb-8 text-center flex flex-col items-center">
              <div className="w-24 h-24 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-6 rotate-3 border-4 border-white/80 overflow-hidden">
                <Play className="text-indigo-600 ml-1" size={48} strokeWidth={2}/>
              </div>
              
              <h2 className="text-2xl font-black text-indigo-950 mb-1 tracking-tight">Worship Presenter</h2>
              <p className="text-indigo-600 font-bold mb-6 tracking-widest text-xs">VERSI 1.0.0</p>
              
              <div className="bg-indigo-50 text-indigo-900 p-5 rounded-2xl mb-6 text-sm leading-relaxed border border-indigo-100 text-left">
                <strong>Tentang Aplikasi Ini:</strong><br/>
                Aplikasi manajemen tata ibadah ini adalah perangkat lunak <em>full free</em> yang didekasikan khusus untuk mendukung pelayanan ibadah multimedia.<br/><br/>
                Dibuat dengan segenap hati <Heart className="inline text-rose-500 mb-1" size={16}/> oleh departemen <strong>MultiMedia Jemaat PISGAH BISDAC (Batam International Seventh-day Adventist Church)</strong>. Pengembangannya secara langsung dipimpin oleh <strong>Herbert JS Sagala</strong>.
              </div>
              
              <a 
                href="https://pisgahbisdac.app/" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all"
              >
                <Globe size={18} /> Kunjungi pisgahbisdac.app
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
