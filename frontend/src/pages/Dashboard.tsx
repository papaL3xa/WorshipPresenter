import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Folder, Search, Settings, Loader2, LogOut } from 'lucide-react';
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
      <header className="glass-panel p-4 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-indigo-900">WorshipPresenter</h1>
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4">
          <button onClick={() => navigate('/library')} className="glass-button text-indigo-900 flex items-center gap-2"><Folder size={16}/> Library</button>
          {localStorage.getItem('worship_role') === 'admin' && (
            <button onClick={() => navigate('/settings')} className="glass-button text-indigo-900 flex items-center gap-2"><Settings size={16}/> Settings</button>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem('worship_is_logged_in');
              localStorage.removeItem('worship_role');
              navigate('/');
            }} 
            className="glass-button bg-red-500/10 text-red-700 hover:bg-red-500/20 flex items-center gap-2 border-red-500/20"
          >
            <LogOut size={16}/> Keluar
          </button>
        </div>
      </header>
      
      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-indigo-900">Jadwal Ibadah Mendatang</h2>
            <button onClick={() => navigate('/playlist/new')} className="glass-button bg-indigo-500/20 text-indigo-900 flex items-center gap-2">
              <Plus size={16} /> Playlist Baru
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-8 text-indigo-900/60"><Loader2 className="animate-spin" size={24} /></div>
          ) : errorMsg ? (
            <div className="text-red-600 bg-red-100 p-3 rounded">{errorMsg}</div>
          ) : playlists.length === 0 ? (
            <div className="text-indigo-900/60 text-center p-4">Tidak ada jadwal ibadah mendatang.</div>
          ) : (
            <div className="space-y-4">
              {playlists.map((pl) => (
                <div key={pl.id} className="p-4 rounded-xl bg-white/40 border border-white/20 flex justify-between items-center hover:bg-white/50 transition">
                  <div>
                    <h3 className="font-semibold text-indigo-900">{pl.name}</h3>
                    <p className="text-sm text-indigo-800/70">{pl.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate('/playlist/edit?id=' + pl.id)} className="glass-button text-indigo-900">Buka</button>
                    <button onClick={() => navigate('/control?id=' + pl.id)} className="glass-button bg-green-500/30 text-green-900 border-green-500/30 font-bold flex items-center gap-1">
                      <Play size={16}/> Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        
        <section className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-indigo-900 mb-6">Pencarian Cepat</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 text-indigo-900/50" size={20} />
            <input 
              type="text" 
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickSearch.trim() !== '') {
                  navigate(`/library?q=${encodeURIComponent(quickSearch.trim())}`);
                }
              }}
              placeholder="Cari lagu atau ayat... (Tekan Enter)" 
              className="glass-input pl-10 w-full" 
            />
          </div>
        </section>
      </main>
    </div>
  );
}
