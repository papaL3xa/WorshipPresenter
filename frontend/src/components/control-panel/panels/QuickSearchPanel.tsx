import React, { useState } from 'react';
import { Music, BookOpen, Search, Loader2, Play, Plus, Calendar, ArrowLeft, BookMarked, Layers } from 'lucide-react';
import { DatabaseVersion, getBibleBookMetadata, getBibleChapterMetadata } from '../../../utils/dbStorage';
import { hasChorus, expandSongWithChorus, isChorusAlreadyEmbedded } from '../../../utils/songHelper';

interface QuickSearchPanelProps {
  searchType: 'song' | 'bible' | 'playlist';
  setSearchType: (t: 'song' | 'bible' | 'playlist') => void;
  selectedSongVersion: string;
  setSelectedSongVersion: (v: string) => void;
  selectedBibleVersion: string;
  setSelectedBibleVersion: (v: string) => void;
  selectedBibleVersion2: string;
  setSelectedBibleVersion2: (v: string) => void;
  dbList: DatabaseVersion[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (e: React.FormEvent) => void;
  isSearching: boolean;
  dashboardPlaylists: any[];
  isLoadingDashboardPlaylists: boolean;
  searchResults: any[];
  allSongTitles: any[] | null;
  currentBibleBooks: string[];
  onNavigateToPlaylist: (id: string) => void;
  onAddToRundown: (item: any) => void;
  onPushTempToLive: (item: any) => void;
  onQuickAddSong: (id: string, isLive: boolean, withChorus?: boolean) => void;
  onDirectSearch?: (query: string, type: 'song' | 'bible') => void;
}

const renderSnippet = (text: string) => {
  if (!text) return '';
  let t = text.replace(/\n/g, ' - ');
  t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]/g, ''); // strip chords
  t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-600 dark:text-yellow-400 font-bold">$1</span>');
  t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span class="text-red-600 dark:text-red-400 font-bold">$1</span>');
  t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-600 dark:text-green-400 font-bold">$1</span>');
  t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-600 dark:text-blue-400 font-bold">$1</span>');
  return t;
};

export const QuickSearchPanel: React.FC<QuickSearchPanelProps> = ({
  searchType,
  setSearchType,
  selectedSongVersion,
  setSelectedSongVersion,
  selectedBibleVersion,
  setSelectedBibleVersion,
  selectedBibleVersion2,
  setSelectedBibleVersion2,
  dbList,
  searchQuery,
  setSearchQuery,
  onSearch,
  isSearching,
  dashboardPlaylists,
  isLoadingDashboardPlaylists,
  searchResults,
  allSongTitles,
  currentBibleBooks,
  onNavigateToPlaylist,
  onAddToRundown,
  onPushTempToLive,
  onQuickAddSong,
  onDirectSearch,
}) => {
  // State untuk navigasi berjenjang Alkitab (Kitab -> Pasal -> Ayat)
  const [selectedBibleBook, setSelectedBibleBook] = useState<string | null>(null);
  const [selectedBibleChapter, setSelectedBibleChapter] = useState<number | null>(null);
  const [bibleChaptersCount, setBibleChaptersCount] = useState<number>(0);
  const [bibleVersesCount, setBibleVersesCount] = useState<number>(0);
  const [isLoadingBibleMeta, setIsLoadingBibleMeta] = useState<boolean>(false);
  const [bookFilterQuery, setBookFilterQuery] = useState<string>('');

  const [autoEmbedChorus, setAutoEmbedChorus] = useState<boolean>(() => {
    try {
      return localStorage.getItem('worship_auto_embed_chorus') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAutoEmbedChorus = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoEmbedChorus(val);
    try {
      localStorage.setItem('worship_auto_embed_chorus', String(val));
    } catch { }
  };

  const filteredBooks = currentBibleBooks.filter(b =>
    b.toLowerCase().includes(bookFilterQuery.toLowerCase().trim())
  );

  return (
    <div className="flex flex-col h-full gap-3">
      {searchType !== 'playlist' && (
        <div className="flex gap-2 shrink-0">
          <div className="flex gap-2 flex-1">
            <button
              type="button"
              onClick={() => { setSearchType('song'); setSearchQuery(''); }}
              className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-xl transition text-xs sm:text-sm font-bold shadow-sm ${searchType === 'song'
                ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-md'
                : 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-slate-300 border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'
                }`}
            >
              <Music size={16} /> Lagu
            </button>
            <button
              type="button"
              onClick={() => { setSearchType('bible'); setSearchQuery(''); }}
              className={`flex-1 flex justify-center items-center gap-2 px-3 py-2 rounded-xl transition text-xs sm:text-sm font-bold shadow-sm ${searchType === 'bible'
                ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black shadow-md'
                : 'bg-white dark:bg-slate-800 text-indigo-900 dark:text-slate-300 border border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'
                }`}
            >
              <BookOpen size={16} /> Alkitab
            </button>
          </div>
          <div className={`flex-1 ${searchType === 'bible' ? 'flex gap-2' : ''}`}>
            <select
              className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-indigo-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 transition shadow-sm"
              value={searchType === 'song' ? selectedSongVersion : selectedBibleVersion}
              onChange={(e) => {
                if (searchType === 'song') {
                  setSelectedSongVersion(e.target.value);
                } else {
                  setSelectedBibleVersion(e.target.value);
                  setSelectedBibleBook(null);
                  setSelectedBibleChapter(null);
                }
              }}
            >
              {dbList.filter(d => d.type === searchType).map(db => (
                <option key={db.id} value={db.id} className="dark:bg-[#0A1128] dark:text-[#C5A059]">{db.name}</option>
              ))}
            </select>
            {searchType === 'bible' && (
              <select
                className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-indigo-900 dark:text-white font-bold focus:outline-none focus:border-indigo-500 transition shadow-sm"
                value={selectedBibleVersion2}
                onChange={(e) => setSelectedBibleVersion2(e.target.value)}
              >
                <option value="none" className="dark:bg-[#0A1128] dark:text-slate-400">-- Teks Tunggal --</option>
                {dbList.filter(d => d.type === 'bible' && d.id !== selectedBibleVersion).map(db => (
                  <option key={db.id} value={db.id} className="dark:bg-[#0A1128] dark:text-[#C5A059]">{db.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        <form onSubmit={onSearch} className="flex gap-2 shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              id="searchInputBox"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Cari ${searchType === 'song' ? 'Lagu' : searchType === 'bible' ? 'Alkitab (misal: Yoh 3:16 atau kata kunci)' : 'Playlist'}...`}
              className="glass-input w-full pr-10 py-3 px-4 text-sm sm:text-base font-semibold !bg-white dark:!bg-slate-900 dark:text-white dark:border-slate-700 rounded-xl shadow-inner transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  document.getElementById('searchInputBox')?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-indigo-900/50 hover:text-indigo-900 hover:bg-indigo-900/10 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Hapus Pencarian"
              >
                <span className="font-extrabold text-sm font-sans">✕</span>
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="glass-button bg-indigo-500/20 dark:bg-slate-800 text-indigo-900 dark:text-[#C5A059] border-indigo-500/30 dark:border-slate-700 px-5 py-2.5 rounded-xl transition flex items-center justify-center shadow-sm"
          >
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </form>

        {searchType === 'song' && (
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-50/70 dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-700/60 text-xs shrink-0 shadow-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-indigo-950 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={autoEmbedChorus}
                onChange={handleToggleAutoEmbedChorus}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Sematkan Chorus setelah tiap Bait ke Rundown</span>
            </label>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">Bait 1 → Reff → Bait 2...</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 border border-indigo-100 dark:border-slate-700 rounded-2xl p-3 bg-white/50 dark:bg-slate-900/50 scrollbar-thin scrollbar-thumb-indigo-200 dark:scrollbar-thumb-slate-700">
          {searchType === 'playlist' ? (
            <div className="flex flex-col gap-2.5 p-1">
              {isLoadingDashboardPlaylists ? (
                <div className="flex justify-center p-6"><Loader2 className="animate-spin text-indigo-600 dark:text-[#C5A059]" size={24} /></div>
              ) : dashboardPlaylists.length === 0 ? (
                <div className="text-center text-sm font-medium text-slate-500 py-6">Tidak ada playlist tersimpan.</div>
              ) : (
                dashboardPlaylists.filter(pl => pl.name.toLowerCase().includes(searchQuery.toLowerCase())).map(pl => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => onNavigateToPlaylist(pl.id)}
                    className="text-left p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-[#C5A059] shadow-sm hover:shadow-md transition-all flex justify-between items-center group cursor-pointer"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg tracking-wide truncate group-hover:text-indigo-600 dark:group-hover:text-[#C5A059] transition-colors">
                        {pl.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold flex items-center gap-1.5">
                        <Calendar size={13} /> {pl.date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-slate-700/60 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 ml-3">
                      <span className="text-xs font-bold text-indigo-600 dark:text-[#C5A059] group-hover:text-white">Buka Playlist</span>
                      <Play size={14} className="text-indigo-600 dark:text-[#C5A059] group-hover:text-white fill-current" />
                    </div>
                  </button>
                ))
              )}
              {dashboardPlaylists.length > 0 && dashboardPlaylists.filter(pl => pl.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="text-center text-sm font-medium text-indigo-900/60 dark:text-slate-500 p-6">Playlist tidak ditemukan.</div>
              )}
            </div>
          ) : (
            <>
              {searchResults.map((res) => {
                const isSong = res.type === 'song' || (!res.book && res.segments);
                const songHasChorus = isSong && hasChorus(res) && !isChorusAlreadyEmbedded(res.segments, res.segmentLabels);
                return (
                  <div key={res.id} className="p-3 mb-2.5 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl transition flex justify-between gap-3 items-center shadow-sm hover:shadow-md">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-indigo-950 dark:text-[#C5A059] text-sm sm:text-base tracking-wide truncate">{res.title}</span>
                        {songHasChorus && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0">
                            Ada Reff
                          </span>
                        )}
                      </div>
                      {(res.author || res.key || res.beat || res.category) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-indigo-600/80 dark:text-slate-400 font-semibold">
                          {res.author && <span className="truncate max-w-[120px]" title={res.author}>👤 {res.author}</span>}
                          {res.key && <span title="Nada Dasar">🎵 Nada: {res.key}</span>}
                          {res.beat && <span title="Ketukan">⏱ {res.beat}</span>}
                          {res.category && <span title="Kategori">🏷️ {res.category}</span>}
                        </div>
                      )}
                      <div
                        className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mt-1.5 leading-relaxed font-medium"
                        dangerouslySetInnerHTML={{ __html: renderSnippet(res.segments && res.segments.length > 1 ? res.segments[1] : res.segments?.[0]) }}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 w-[115px]">
                      <button
                        type="button"
                        onClick={() => {
                          const itemToAdd = autoEmbedChorus && songHasChorus ? expandSongWithChorus(res) : res;
                          onAddToRundown(itemToAdd);
                        }}
                        className="bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-500/30 dark:border-green-700 px-2.5 py-1.5 rounded-lg transition font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-1.5 w-full shadow-xs"
                      >
                        <Plus size={13} /> Rundown
                      </button>
                      {songHasChorus && !autoEmbedChorus && (
                        <button
                          type="button"
                          onClick={() => onAddToRundown(expandSongWithChorus(res))}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-500/30 dark:border-amber-700 px-1.5 py-1 rounded-lg transition font-bold text-[10px] flex justify-center items-center gap-1 w-full shadow-xs"
                          title="Tambahkan lagu ke rundown dengan Chorus disisipkan setelah tiap bait"
                        >
                          ⚡ + Reff/Bait
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const itemToPlay = autoEmbedChorus && songHasChorus ? expandSongWithChorus(res) : res;
                          onPushTempToLive(itemToPlay);
                        }}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-500/30 dark:border-red-700 px-2.5 py-1.5 rounded-lg transition font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-1.5 w-full shadow-xs"
                      >
                        <Play size={13} className="fill-current" /> Live
                      </button>
                    </div>
                  </div>
                );
              })}
              {searchResults.length === 0 && !isSearching && searchQuery !== '' && (
                <div className="text-center text-sm font-medium text-indigo-900/60 dark:text-slate-500 p-6">Tidak ada hasil ditemukan.</div>
              )}
              {searchResults.length === 0 && !isSearching && searchQuery === '' && (
                <div className="p-1">
                  {searchType === 'song' ? (
                    <div className="flex flex-col gap-1.5">
                      {allSongTitles ? allSongTitles.map((song: any) => (
                        <div key={song.id} className="p-2.5 mb-1 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl transition flex justify-between gap-3 items-center shadow-xs hover:shadow-sm">
                          <div className="flex-1 overflow-hidden flex items-start gap-2.5">
                            <span className="bg-indigo-100 dark:bg-black/40 text-indigo-800 dark:text-[#C5A059] px-2.5 py-1 rounded-lg text-xs font-bold min-w-[36px] text-center shrink-0 border border-indigo-200 dark:border-slate-700 mt-0.5">{song.id}</span>
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="font-bold text-indigo-950 dark:text-[#C5A059] text-sm sm:text-base truncate">{song.title}</div>
                              {(song.author || song.key || song.beat || song.category) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-indigo-600/80 dark:text-slate-400 mt-1 font-semibold">
                                  {song.author && <span className="truncate max-w-[120px]" title={song.author}>👤 {song.author}</span>}
                                  {song.key && <span title="Nada Dasar">🎵 {song.key}</span>}
                                  {song.beat && <span title="Ketukan">⏱ {song.beat}</span>}
                                  {song.category && <span title="Kategori">🏷️ {song.category}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0 w-[115px]">
                            <button
                              type="button"
                              onClick={() => onQuickAddSong(song.id.toString(), false, autoEmbedChorus)}
                              className="bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-500/30 dark:border-green-700 px-2.5 py-1.5 rounded-lg transition font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-1.5 w-full shadow-xs"
                            >
                              <Plus size={13} /> Rundown
                            </button>
                            {!autoEmbedChorus && (
                              <button
                                type="button"
                                onClick={() => onQuickAddSong(song.id.toString(), false, true)}
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-500/30 dark:border-amber-700 px-1.5 py-1 rounded-lg transition font-bold text-[10px] flex justify-center items-center gap-1 w-full shadow-xs"
                                title="Tambahkan ke rundown dengan Chorus disisipkan setelah tiap bait"
                              >
                                ⚡ + Reff/Bait
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onQuickAddSong(song.id.toString(), true, autoEmbedChorus)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-500/30 dark:border-red-700 px-2.5 py-1.5 rounded-lg transition font-bold uppercase tracking-wider text-xs flex justify-center items-center gap-1.5 w-full shadow-xs"
                            >
                              <Play size={13} className="fill-current" /> Live
                            </button>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center p-6"><Loader2 size={20} className="animate-spin text-indigo-500 mx-auto" /></div>
                      )}
                    </div>
                  ) : (
                    /* Navigasi Berjenjang Alkitab (Kitab -> Pasal -> Ayat) */
                    <div className="flex flex-col gap-3">
                      {/* Step 1: Pilih Kitab */}
                      {!selectedBibleBook ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                              <BookMarked size={14} className="text-indigo-600 dark:text-[#C5A059]" />
                              Langkah 1: Pilih Kitab
                            </span>
                            <div className="relative w-44 sm:w-56">
                              <input
                                type="text"
                                value={bookFilterQuery}
                                onChange={(e) => setBookFilterQuery(e.target.value)}
                                placeholder="Cari kitab (misal: Yoh, Kej)..."
                                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                              />
                              {bookFilterQuery && (
                                <button
                                  type="button"
                                  onClick={() => setBookFilterQuery('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {filteredBooks.length > 0 ? filteredBooks.map(book => (
                              <button
                                key={book}
                                type="button"
                                onClick={async () => {
                                  setSelectedBibleBook(book);
                                  setIsLoadingBibleMeta(true);
                                  const maxC = await getBibleBookMetadata(selectedBibleVersion, book);
                                  setBibleChaptersCount(maxC);
                                  setIsLoadingBibleMeta(false);
                                }}
                                className="p-3 text-center text-xs sm:text-sm font-bold text-indigo-950 dark:text-slate-100 bg-white/80 dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 rounded-xl hover:border-indigo-600 dark:hover:border-[#C5A059] hover:bg-indigo-600 hover:text-white dark:hover:bg-[#C5A059] dark:hover:text-black transition line-clamp-1 shadow-xs active:scale-95"
                              >
                                {book}
                              </button>
                            )) : (
                              <div className="col-span-full text-center p-6 text-sm text-slate-500">
                                {currentBibleBooks.length === 0 ? (
                                  <Loader2 size={22} className="animate-spin text-indigo-500 mx-auto" />
                                ) : (
                                  'Kitab tidak ditemukan.'
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : !selectedBibleChapter ? (
                        /* Step 2: Pilih Pasal */
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between bg-indigo-50/80 dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBibleBook(null);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 text-indigo-700 dark:text-[#C5A059] hover:bg-indigo-100 dark:hover:bg-slate-600 shadow-xs transition"
                            >
                              <ArrowLeft size={14} /> Ganti Kitab
                            </button>
                            <div className="text-sm sm:text-base font-extrabold text-indigo-950 dark:text-white flex items-center gap-1.5">
                              <span className="text-indigo-600 dark:text-[#C5A059]">{selectedBibleBook}</span>
                              <span className="text-slate-400 font-normal">»</span>
                              <span>Pilih Pasal (1 - {bibleChaptersCount})</span>
                            </div>
                          </div>

                          {isLoadingBibleMeta ? (
                            <div className="text-center p-8"><Loader2 size={26} className="animate-spin text-indigo-500 mx-auto" /></div>
                          ) : (
                            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {Array.from({ length: bibleChaptersCount }, (_, i) => i + 1).map(chap => (
                                <button
                                  key={chap}
                                  type="button"
                                  onClick={async () => {
                                    setSelectedBibleChapter(chap);
                                    setIsLoadingBibleMeta(true);
                                    const maxV = await getBibleChapterMetadata(selectedBibleVersion, selectedBibleBook!, chap);
                                    setBibleVersesCount(maxV);
                                    setIsLoadingBibleMeta(false);
                                  }}
                                  className="py-3 text-center text-sm sm:text-base font-extrabold text-indigo-950 dark:text-slate-100 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 rounded-xl hover:border-indigo-600 dark:hover:border-[#C5A059] hover:bg-indigo-600 hover:text-white dark:hover:bg-[#C5A059] dark:hover:text-black transition shadow-xs active:scale-95"
                                >
                                  {chap}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Step 3: Pilih Ayat */
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-indigo-50/80 dark:bg-slate-800 p-2.5 rounded-xl border border-indigo-100 dark:border-slate-700">
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBibleBook(null);
                                  setSelectedBibleChapter(null);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-600 transition shadow-xs"
                                title="Kembali ke daftar kitab"
                              >
                                Kitab
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBibleChapter(null);
                                }}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-700 text-indigo-700 dark:text-[#C5A059] hover:bg-indigo-50 dark:hover:bg-slate-600 transition shadow-xs"
                              >
                                <ArrowLeft size={13} /> Ganti Pasal
                              </button>
                            </div>
                            <div className="text-sm sm:text-base font-extrabold text-indigo-950 dark:text-white flex items-center gap-1.5">
                              <span className="text-indigo-600 dark:text-[#C5A059]">{selectedBibleBook} {selectedBibleChapter}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">({bibleVersesCount} Ayat)</span>
                            </div>
                          </div>

                          {/* Tombol Cepat: Tampilkan Seluruh Pasal */}
                          <button
                            type="button"
                            onClick={() => {
                              const query = `${selectedBibleBook} ${selectedBibleChapter}`;
                              setSearchQuery(query);
                              if (onDirectSearch) {
                                onDirectSearch(query, 'bible');
                              } else {
                                onSearch({ preventDefault: () => { } } as any);
                              }
                            }}
                            className="w-full py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-[#C5A059] dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                          >
                            <Layers size={15} /> Tampilkan Seluruh Pasal {selectedBibleChapter} (Ayat 1 - {bibleVersesCount})
                          </button>

                          {isLoadingBibleMeta ? (
                            <div className="text-center p-8"><Loader2 size={26} className="animate-spin text-indigo-500 mx-auto" /></div>
                          ) : (
                            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                              {Array.from({ length: bibleVersesCount }, (_, i) => i + 1).map(verse => (
                                <button
                                  key={verse}
                                  type="button"
                                  onClick={() => {
                                    const query = `${selectedBibleBook} ${selectedBibleChapter}:${verse}`;
                                    setSearchQuery(query);
                                    if (onDirectSearch) {
                                      onDirectSearch(query, 'bible');
                                    } else {
                                      onSearch({ preventDefault: () => { } } as any);
                                    }
                                  }}
                                  className="py-3 text-center text-sm sm:text-base font-extrabold text-indigo-950 dark:text-slate-100 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 rounded-xl hover:border-indigo-600 dark:hover:border-[#C5A059] hover:bg-indigo-600 hover:text-white dark:hover:bg-[#C5A059] dark:hover:text-black transition shadow-xs active:scale-95 cursor-pointer"
                                >
                                  {verse}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
