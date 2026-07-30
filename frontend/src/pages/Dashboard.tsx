import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Folder, Search, Settings, Loader2, LogOut } from 'lucide-react';
import { SyncButton } from '../components/SyncButton';
import { callApi } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [quickSearch, setQuickSearch] = useState('');

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

  useEffect(() => {
    fetchPlaylists();
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="glass-panel p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-heading font-extrabold text-white drop-shadow-md tracking-tight flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm border border-white/30">
            <Play className="text-white fill-white" size={24}/>
          </div>
          WorshipPresenter
        </h1>
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
          <SyncButton />
          <button onClick={() => navigate('/library')} className="glass-button flex items-center gap-2"><Folder size={18}/> Library</button>
          {localStorage.getItem('worship_role') === 'admin' && (
            <button onClick={() => navigate('/settings')} className="glass-button flex items-center gap-2"><Settings size={18}/> Settings</button>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('worship_is_logged_in');
              localStorage.removeItem('worship_role');
              navigate('/');
            }} 
            className="glass-button bg-red-500/20 text-red-900 border-red-500/30 hover:bg-red-500/30 hover:text-red-950 flex items-center gap-2"
          >
            <LogOut size={18}/> Keluar
          </button>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="glass-panel p-6 lg:col-span-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-heading font-bold text-slate-800 drop-shadow-sm">Jadwal Ibadah Mendatang</h2>
            <button onClick={() => navigate('/playlist/new')} className="glass-button bg-indigo-500/20 text-indigo-900 border-indigo-500/30 hover:bg-indigo-500/30 flex items-center gap-2">
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
            <div className="space-y-4">
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
                    <button onClick={() => navigate('/playlist/edit?id=' + pl.id)} className="glass-button flex-1 md:flex-none justify-center">Buka</button>
                    <button onClick={() => navigate('/control?id=' + pl.id)} className="glass-button flex-1 md:flex-none justify-center bg-gradient-to-r from-emerald-400 to-teal-500 text-white border-transparent shadow-lg hover:shadow-emerald-500/40 font-bold flex items-center gap-2">
                      <Play size={16} className="fill-white"/> Live
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
    </div>
  );
}
