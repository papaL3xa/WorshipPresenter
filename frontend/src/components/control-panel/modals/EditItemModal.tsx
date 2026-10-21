import React, { useState, useRef } from 'react';
import { X, Edit, Trash2, Plus, Eye, Layout } from 'lucide-react';
import { RichEditor, RichEditorRef } from '../../RichEditor';
import { calculateOptimalFontSize } from '../../../utils/fontCalculator';
import { hasChorus, expandSongWithChorus, isChorusAlreadyEmbedded } from '../../../utils/songHelper';

interface PlaylistItem {
  id: string;
  type?: 'song' | 'bible' | 'announcement' | 'countdown' | 'image' | 'video';
  title?: string;
  hideHeaderTitle?: boolean;
  headerTitleFontSizeOffset?: number;
  segments: string[];
  segmentLabels?: string[];
  visibleSegments?: number[];
  [key: string]: any;
}

interface EditItemModalProps {
  isOpen: boolean;
  item: PlaylistItem | null;
  itemIndex: number | null;
  editSegmentIndex: number;
  setEditSegmentIndex: (index: number) => void;
  onUpdateItem: (index: number, updatedItem: PlaylistItem) => void;
  onDeleteItem: (index: number) => void;
  onClose: () => void;
}

/**
 * Parser teks kaya untuk simulasi tampilan langsung di dalam modal edit
 */
const processPreviewText = (raw: string): string => {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/\[([A-G][#b]?[a-zA-Z0-9/]{0,6})\]([^\[\n]*)/g, ''); // bersihkan chord di tampilan teks biasa

  // Kolom dwi-bahasa
  if (t.includes('\n[kuning]')) {
    const parts = t.split('\n[kuning]');
    if (parts.length === 2 && parts[1].endsWith('[/kuning]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kuning]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-4 w-full"><div class="text-left">${left}</div><div class="text-right text-yellow-300">${right}</div></div>`;
    }
  }

  // 2-Kolom Bebas (Pengumuman)
  if (t.includes('\n[kolom2]')) {
    const parts = t.split('\n[kolom2]');
    if (parts.length === 2 && parts[1].endsWith('[/kolom2]')) {
      const left = parts[0].replace(/\n/g, '<br/>');
      const right = parts[1].replace('[/kolom2]', '').replace(/\n/g, '<br/>');
      return `<div class="grid grid-cols-2 gap-4 w-full"><div class="text-left">${left}</div><div class="text-left">${right}</div></div>`;
    }
  }

  t = t.replace(/\n/g, '<br/>');
  t = t.replace(/\[merah\](.*?)\[\/merah\]/gi, '<span class="text-red-500 font-bold">$1</span>');
  t = t.replace(/\[kuning\](.*?)\[\/kuning\]/gi, '<span class="text-yellow-400 font-bold">$1</span>');
  t = t.replace(/\[hijau\](.*?)\[\/hijau\]/gi, '<span class="text-green-400 font-bold">$1</span>');
  t = t.replace(/\[biru\](.*?)\[\/biru\]/gi, '<span class="text-blue-400 font-bold">$1</span>');
  t = t.replace(/\[ungu\](.*?)\[\/ungu\]/gi, '<span class="text-purple-400 font-bold">$1</span>');
  t = t.replace(/\[oranye\](.*?)\[\/oranye\]/gi, '<span class="text-orange-400 font-bold">$1</span>');
  return t;
};

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  item,
  itemIndex,
  editSegmentIndex,
  setEditSegmentIndex,
  onUpdateItem,
  onDeleteItem,
  onClose,
}) => {
  const editorRef = useRef<RichEditorRef>(null);
  const [, setHasSelection] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<'left' | 'top'>('left');

  if (!isOpen || !item || itemIndex === null) return null;

  // Sekarang mencakup song, bible, DAN announcement (pengumuman)
  const itemType = item.type || (item.book ? 'bible' : 'song');
  const supportsHeaderTitle = itemType === 'song' || itemType === 'bible' || itemType === 'announcement';

  // Cek apakah slide saat ini adalah slide judul
  const currentLabel = item.segmentLabels?.[editSegmentIndex] || '';
  const isJudulSlide = currentLabel.toLowerCase() === 'judul';
  const showHeader = supportsHeaderTitle && !item.hideHeaderTitle && item.title && !isJudulSlide;

  // Ukuran font otomatis cerdas (Auto-Fit) sama persis dengan layar display proyektor
  const optimalFontSize = calculateOptimalFontSize(item.segments[editSegmentIndex] || '', {
    is2Column: (item.segments[editSegmentIndex] || '').includes('\n[kuning]') || (item.segments[editSegmentIndex] || '').includes('\n[kolom2]'),
    lineHeight: 1.15,
    fontSizeOffset: 0
  });

  // Komponen Pratinjau Layar Display
  const renderPreviewBox = () => (
    <div className="flex flex-col gap-2 bg-slate-100/80 dark:bg-slate-800/60 p-4 rounded-3xl border border-indigo-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Eye size={15} className="text-indigo-600 dark:text-[#C5A059]" />
          Pratinjau Layar Display
        </span>
        <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white tracking-widest uppercase shadow-xs">
          Live Monitor
        </span>
      </div>

      {/* 16:9 Aspect Ratio Monitor Display Box */}
      <div
        className="aspect-video w-full rounded-2xl bg-black border border-slate-700/80 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center p-4 select-none"
        style={{ containerType: 'inline-size' }}
      >
        {/* Radial Backdrop Subtle Lighting */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(30, 27, 75, 0.45) 0%, rgba(0, 0, 0, 0.95) 100%)' }}
        />

        {/* Header Title (jika bukan slide Judul dan tidak disembunyikan) */}
        {showHeader && (
          <h2
            className="absolute top-[6%] left-0 right-0 w-full px-4 text-center font-heading font-bold text-yellow-300 opacity-90 tracking-wider truncate z-10 animate-fade-in"
            style={{
              fontSize: `${1.5 + 0.5 + (item.headerTitleFontSizeOffset || 0)}cqw`,
              textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 3px 10px rgba(0,0,0,0.9)'
            }}
          >
            {item.title}
          </h2>
        )}

        {/* Center Content Preview */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center my-auto px-3">
          {item.type === 'countdown' ? (
            <div className="text-white text-center font-bold tracking-widest font-mono text-4xl drop-shadow-xl">
              {String(Math.floor(parseInt(item.segments[0] || '0') / 60)).padStart(2, '0')}:{String(parseInt(item.segments[0] || '0') % 60).padStart(2, '0')}
            </div>
          ) : (
            <div
              className="text-center whitespace-pre-wrap font-bold text-white leading-relaxed drop-shadow-lg w-full overflow-hidden"
              style={{
                lineHeight: 1.15,
                textShadow: '1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000, 0 4px 10px rgba(0,0,0,0.8)',
                fontSize: `${optimalFontSize}cqw`
              }}
              dangerouslySetInnerHTML={{ __html: processPreviewText(item.segments[editSegmentIndex] || '') }}
            />
          )}

          {/* Subtitle Label (Bait / Slide / Ayat) */}
          {item.type !== 'countdown' && !isJudulSlide && (
            <div
              className="text-yellow-300 font-bold tracking-widest uppercase opacity-80 mt-2 text-center animate-fade-in"
              style={{
                fontSize: '1.5cqw',
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 10px rgba(0,0,0,0.9)'
              }}
            >
              {currentLabel || (item.type === 'song' ? '•' : item.type === 'announcement' ? `Slide ${editSegmentIndex + 1}` : `Ayat ${editSegmentIndex + 1}`)}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center">
        Tampilan di atas mensimulasikan layar display sesungguhnya secara proporsional (16:9).
      </p>
    </div>
  );

  // Komponen Form Editor
  const renderEditorForm = () => (
    <div className="space-y-4">
      {/* Title Input & Sembunyikan Header */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            Judul {item.type === 'announcement' ? 'Pengumuman' : 'Header'}
          </label>
          <input
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-indigo-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-all"
            value={item.title || ''}
            onChange={(e) => {
              onUpdateItem(itemIndex, { ...item, title: e.target.value });
            }}
            placeholder={item.type === 'announcement' ? "Contoh: PENGUMUMAN JEMAAT" : "Masukkan Judul..."}
          />
        </div>

        {supportsHeaderTitle && (
          <div className="flex-none bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col items-center justify-center">
            <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 text-center cursor-pointer select-none">
              Sembunyikan<br />Judul
            </label>
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              checked={item.hideHeaderTitle || false}
              onChange={(e) => {
                onUpdateItem(itemIndex, { ...item, hideHeaderTitle: e.target.checked });
              }}
            />
          </div>
        )}
      </div>

      {/* Title Font Size Control Slider */}
      {supportsHeaderTitle && !item.hideHeaderTitle && (
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            <span>Ukuran Font Judul Header</span>
            <span className="text-indigo-600 dark:text-[#C5A059] font-mono">
              {(item.headerTitleFontSizeOffset || 0) > 0 ? '+' : ''}{item.headerTitleFontSizeOffset || 0}
            </span>
          </div>
          <input
            type="range"
            min="-1"
            max="5"
            step="0.5"
            value={item.headerTitleFontSizeOffset || 0}
            onChange={(e) => {
              onUpdateItem(itemIndex, { ...item, headerTitleFontSizeOffset: Number(e.target.value) });
            }}
            className="w-full accent-indigo-600 dark:accent-[#C5A059] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
            <span>Kecil (-1)</span>
            <span>Normal (0)</span>
            <span>Besar (+5)</span>
          </div>
        </div>
      )}

      {/* Countdown Inputs */}
      {item.type === 'countdown' ? (
        <div className="flex gap-4 items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col items-center">
            <input
              type="number"
              className="w-24 text-center bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-slate-700 rounded-xl p-3 text-3xl focus:outline-none focus:border-indigo-500 transition-all font-bold dark:text-white"
              value={Math.floor(parseInt(item.segments[0] || '0') / 60)}
              onChange={(e) => {
                const sec = parseInt(item.segments[0] || '0') % 60;
                onUpdateItem(itemIndex, { ...item, segments: [String(Number(e.target.value) * 60 + sec)] });
              }}
            />
            <span className="text-slate-500 dark:text-slate-400 mt-2 text-xs font-bold uppercase tracking-wider">Menit</span>
          </div>
          <div className="text-3xl font-bold text-slate-300 dark:text-slate-600 pb-6">:</div>
          <div className="flex flex-col items-center">
            <input
              type="number"
              className="w-24 text-center bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-slate-700 rounded-xl p-3 text-3xl focus:outline-none focus:border-indigo-500 transition-all font-bold dark:text-white"
              value={parseInt(item.segments[0] || '0') % 60}
              onChange={(e) => {
                const min = Math.floor(parseInt(item.segments[0] || '0') / 60);
                onUpdateItem(itemIndex, { ...item, segments: [String(min * 60 + Number(e.target.value))] });
              }}
            />
            <span className="text-slate-500 dark:text-slate-400 mt-2 text-xs font-bold uppercase tracking-wider">Detik</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Segment Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {item.segments.map((_: any, i: number) => {
              const isMulti = item.segments.length > 1;
              const isActive = editSegmentIndex === i;
              return (
                <div key={i} className="flex relative group">
                  <button
                    onClick={() => setEditSegmentIndex(i)}
                    className={`px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      } ${isActive && isMulti ? 'rounded-l-lg pr-2' : 'rounded-lg'}`}
                  >
                    {item.segmentLabels?.[i] || (item.type === 'announcement' ? `Slide ${i + 1}` : `Bait ${i + 1}`)}
                  </button>
                  {isActive && isMulti && (
                    <button
                      onClick={() => {
                        if (confirm('Hapus ' + (item.type === 'announcement' ? 'slide' : 'bait') + ' ini?')) {
                          const newSegments = item.segments.filter((_: any, idx: number) => idx !== i);
                          const newLabels = item.segmentLabels ? item.segmentLabels.filter((_: any, idx: number) => idx !== i) : undefined;
                          const newVisible = Array.isArray(item.visibleSegments) ? item.visibleSegments.filter((idx: number) => idx !== i).map((idx: number) => idx > i ? idx - 1 : idx) : undefined;
                          onUpdateItem(itemIndex, {
                            ...item,
                            segments: newSegments,
                            segmentLabels: newLabels,
                            visibleSegments: newVisible
                          });
                          setEditSegmentIndex(Math.max(0, i - 1));
                        }
                      }}
                      className="bg-indigo-700 hover:bg-red-500 text-white/80 hover:text-white px-2 py-1.5 rounded-r-lg transition-colors flex items-center justify-center border-l border-indigo-500/50"
                      title="Hapus"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {(item.type === 'song' || item.type === 'announcement') && (
              <button
                onClick={() => {
                  const currentLabels = item.segmentLabels || item.segments.map((_: any, i: number) => item.type === 'announcement' ? `Slide ${i + 1}` : `Bait ${i + 1}`);
                  const newLabel = item.type === 'announcement' ? `Slide ${item.segments.length + 1}` : `Bait ${item.segments.length + 1}`;
                  onUpdateItem(itemIndex, {
                    ...item,
                    segments: [...item.segments, ''],
                    segmentLabels: [...currentLabels, newLabel]
                  });
                  setEditSegmentIndex(item.segments.length);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-green-100 text-green-700 hover:bg-green-200 transition-all flex items-center gap-1"
              >
                <Plus size={13} /> {item.type === 'announcement' ? 'Tambah Slide' : 'Tambah Bait'}
              </button>
            )}
            {item.type === 'song' && hasChorus(item) && !isChorusAlreadyEmbedded(item.segments, item.segmentLabels) && (
              <button
                type="button"
                onClick={() => {
                  const updated = expandSongWithChorus(item);
                  onUpdateItem(itemIndex, updated);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 transition-all flex items-center gap-1 shadow-xs whitespace-nowrap"
                title="Sematkan Chorus setelah tiap bait dalam lagu ini"
              >
                ⚡ Sisipkan Chorus Tiap Bait
              </button>
            )}
          </div>

          {/* Rich Editor */}
          <div className="flex flex-col gap-2">
            {(() => {
              const val = item.segments[editSegmentIndex] || '';
              const is2Kolom = val.includes('\n[kolom2]') && val.endsWith('[/kolom2]');

              const setVal = (newVal: string) => {
                const newSegments = [...item.segments];
                newSegments[editSegmentIndex] = newVal;
                onUpdateItem(itemIndex, { ...item, segments: newSegments });
              };

              if (is2Kolom) {
                const parts = val.split('\n[kolom2]');
                const left = parts[0] || '';
                const right = parts[1] ? parts[1].replace('[/kolom2]', '') : '';
                return (
                  <div className="flex gap-3 w-full">
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Kolom Kiri</span>
                      <RichEditor
                        ref={editorRef}
                        className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 text-indigo-900 dark:text-white whitespace-pre-wrap leading-relaxed transition-all resize-y"
                        value={left}
                        onChange={(v: string) => {
                          if (!v && !right) setVal('');
                          else if (!right) setVal(v);
                          else setVal(v + '\n[kolom2]' + right + '[/kolom2]');
                        }}
                        onSelectChange={setHasSelection}
                        placeholder="Teks kiri..."
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kolom Kanan</span>
                        <button onClick={() => setVal(left)} className="text-[10px] font-bold text-red-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition">✕ Tutup</button>
                      </div>
                      <RichEditor
                        className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 text-indigo-900 dark:text-white whitespace-pre-wrap leading-relaxed transition-all resize-y"
                        value={right}
                        onChange={(v: string) => {
                          if (!v && !left) setVal('');
                          else if (!left) setVal(left);
                          else setVal(left + '\n[kolom2]' + v + '[/kolom2]');
                        }}
                        onSelectChange={setHasSelection}
                        placeholder="Teks kanan..."
                      />
                    </div>
                  </div>
                );
              }

              return (
                <div className="relative group w-full">
                  <RichEditor
                    ref={editorRef}
                    className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 text-indigo-900 dark:text-white whitespace-pre-wrap leading-relaxed transition-all resize-y"
                    value={val}
                    onChange={setVal}
                    onSelectChange={setHasSelection}
                    placeholder="Ketik teks di sini (blok teks untuk mewarnai)..."
                  />
                  <button
                    onClick={() => setVal(val + '\n[kolom2][/kolom2]')}
                    className="absolute bottom-3 right-3 text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-white/90 dark:bg-slate-700/90 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-slate-600 px-2.5 py-1 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                  >
                    + Kolom Kanan
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/75 z-[9999] flex justify-center items-center p-2 sm:p-4 md:p-6 backdrop-blur-md">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-5 md:p-6 rounded-3xl shadow-2xl max-w-[1360px] w-[96vw] max-h-[94vh] h-[92vh] border border-white/50 dark:border-slate-700/60 relative flex flex-col">
        {/* Tombol Tutup X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-2 transition-all z-20"
          title="Tutup (Esc)"
        >
          <X size={20} />
        </button>

        {/* Modal Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pr-12 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-indigo-900 dark:text-[#C5A059] flex items-center gap-2">
            <Edit size={22} /> Edit {item.type === 'announcement' ? 'Pengumuman' : item.type === 'countdown' ? 'Hitung Mundur' : 'Lagu / Teks'}
          </h2>

          {/* Pengatur Posisi Pratinjau (Kiri atau Atas) */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Layout size={13} /> Posisi Pratinjau:
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPreviewPosition('left')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${previewPosition === 'left'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                Kiri
              </button>
              <button
                type="button"
                onClick={() => setPreviewPosition('top')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${previewPosition === 'top'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                Atas
              </button>
            </div>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          {previewPosition === 'left' ? (
            /* Layout Bersebelahan: Pratinjau di Kiri, Editor di Kanan */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 sticky top-0">
                {renderPreviewBox()}
              </div>
              <div className="lg:col-span-6">
                {renderEditorForm()}
              </div>
            </div>
          ) : (
            /* Layout Bertingkat: Pratinjau di Atas, Editor di Bawah */
            <div className="flex flex-col gap-6">
              <div className="w-full max-w-3xl mx-auto">
                {renderPreviewBox()}
              </div>
              <div className="w-full max-w-4xl mx-auto">
                {renderEditorForm()}
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => onDeleteItem(itemIndex)}
            className="px-4 py-2 rounded-xl text-red-600 font-bold hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2 transition text-sm"
          >
            <Trash2 size={15} /> Hapus Item
          </button>
          <button onClick={onClose} className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition text-sm">
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
