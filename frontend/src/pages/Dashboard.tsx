import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Folder, Search, Settings, Loader2, Trash2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    </div>
  );
}
