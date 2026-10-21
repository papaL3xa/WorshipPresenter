import React, { useRef } from 'react';
import { Bold, Image as ImageIcon, EyeOff, RotateCcw, Trash2 } from 'lucide-react';

export interface DisplayTheme {
  color?: string;
  fontSizeOffset?: number;
  position?: 'center' | 'top' | 'bottom';
  bold?: boolean;
  shadow?: 'dark' | 'light' | 'none';
  paddingHorizontal?: number;
  lineHeight?: number;
  titleOffsetY?: number;
  contentOffsetY?: number;
  headerTitleFontSizeOffset?: number;
  transitionStyle?: 'crossfade' | 'slideUp' | 'slideDown' | 'zoom';
  aspectRatio?: 'full' | '16:9' | '16:10' | '4:3';
  layout?: 'full' | 'lower-third';
  lowerThirdStyle?: 'dark-glass' | 'gradient' | 'minimal' | 'solid';
  blankImageUrl?: string;
  blankImageFit?: 'contain' | 'cover'; // Mode ukuran gambar layar blank (contain: logo proporsional, cover: layar penuh)
  logoScreenUrl?: string; // Khusus Layar Logo Utama di Display (Hotkey L)
  backgroundDim?: number; // 0 to 90 (default 40)
  enableVignette?: boolean; // subtle radial vignette on edges
}

interface ThemeSettingsPanelProps {
  displayTheme: DisplayTheme;
  updateTheme: (patch: Partial<DisplayTheme>) => void;
  onBlankUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogoLUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogoL?: () => void;
  onResetLogoL?: () => void;
  onRemoveBlankImage?: () => void;
  onResetBlankImage?: () => void;
}

export const ThemeSettingsPanel: React.FC<ThemeSettingsPanelProps> = ({
  displayTheme,
  updateTheme,
  onBlankUpload,
  onLogoLUpload,
  onRemoveLogoL,
  onResetLogoL,
  onRemoveBlankImage,
  onResetBlankImage,
}) => {
  const blankInputRef = useRef<HTMLInputElement>(null);
  const logoLInputRef = useRef<HTMLInputElement>(null);

  const colors = ['#ffffff', '#fde68a', '#fca5a5', '#86efac', '#93c5fd', '#f0abfc', '#fdba74'];

  return (
    <div className="flex flex-col gap-5 p-1">
      {/* Warna Teks */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          🎨 Warna Teks Utama
        </label>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {colors.map(c => (
              <button
                key={c}
                onClick={() => updateTheme({ color: c })}
                className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${displayTheme.color === c ? 'border-indigo-500 scale-110 shadow-md' : 'border-white/50'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Ukuran Font Konten */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 block">
            📏 Ukuran Font Konten Lirik / Ayat / Pengumuman
          </label>
        </div>
        <p className="text-[10px] text-slate-500 mb-2">
          Otomatis menyesuaikan (Auto-Fit) agar font tetap besar & proporsional meski ayat atau lirik panjang.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={-3} max={4} step={0.5}
            value={displayTheme.fontSizeOffset || 0}
            onChange={(e) => updateTheme({ fontSizeOffset: parseFloat(e.target.value) })}
            className="flex-1 accent-purple-600"
          />
          <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 w-10 text-center font-mono">
            {(displayTheme.fontSizeOffset || 0) > 0 ? '+' : ''}{displayTheme.fontSizeOffset || 0}
          </span>
          <button
            onClick={() => updateTheme({ fontSizeOffset: 0 })}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Ukuran Font Header Judul */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          📏 Ukuran Font Judul Header (Global)
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={-1} max={5} step={0.5}
            value={displayTheme.headerTitleFontSizeOffset !== undefined ? displayTheme.headerTitleFontSizeOffset : 0.5}
            onChange={(e) => updateTheme({ headerTitleFontSizeOffset: parseFloat(e.target.value) })}
            className="flex-1 accent-purple-600"
          />
          <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200 w-10 text-center">
            {(displayTheme.headerTitleFontSizeOffset !== undefined ? displayTheme.headerTitleFontSizeOffset : 0.5) > 0 ? '+' : ''}{displayTheme.headerTitleFontSizeOffset !== undefined ? displayTheme.headerTitleFontSizeOffset : 0.5}
          </span>
          <button
            onClick={() => updateTheme({ headerTitleFontSizeOffset: 0.5 })}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-bold px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Posisi Teks */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          📍 Posisi Vertikal Teks
        </label>
        <div className="flex gap-2">
          {([['top', 'Atas'], ['center', 'Tengah'], ['bottom', 'Bawah']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateTheme({ position: val })}
              className={`flex-1 py-2 rounded-xl font-bold text-xs border-2 transition-all ${(displayTheme.position || 'center') === val ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Gaya Teks */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          ✍️ Ketebalan Teks
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => updateTheme({ bold: !(displayTheme.bold !== false) })}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition-all flex items-center justify-center gap-1.5 ${(displayTheme.bold !== false) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
          >
            <Bold size={13} /> Tebal (Bold)
          </button>
          <button
            onClick={() => updateTheme({ bold: false })}
            className={`flex-1 py-2.5 rounded-xl text-xs border-2 transition-all ${!(displayTheme.bold !== false) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70 font-medium'}`}
          >
            Normal
          </button>
        </div>
      </div>

      {/* Bayangan Teks */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          🌑 Bayangan Teks (Shadow)
        </label>
        <div className="flex gap-2">
          {([['dark', 'Gelap'], ['light', 'Terang'], ['none', 'Tanpa']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateTheme({ shadow: val })}
              className={`flex-1 py-2 rounded-xl font-bold text-xs border-2 transition-all ${(displayTheme.shadow || 'dark') === val ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Transisi Teks */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          ✨ Gaya Transisi Pergantian Slide
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([['crossfade', 'Pudar (Fade)'], ['slideUp', 'Naik (Slide Up)'], ['slideDown', 'Turun (Slide Down)'], ['zoom', 'Memperbesar (Zoom)']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateTheme({ transitionStyle: val })}
              className={`py-2 rounded-xl font-bold text-xs border-2 transition-all ${(displayTheme.transitionStyle || 'crossfade') === val ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Geser Posisi Judul */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          ↕️ Geser Posisi Judul (Naik/Turun)
        </label>
        <div className="flex items-center gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-indigo-100 dark:border-white/5">
          <span className="text-[10px] font-bold text-indigo-900/70 dark:text-slate-500 uppercase">Naik</span>
          <input
            type="range"
            min="-5" max="10" step="1"
            value={displayTheme.titleOffsetY ?? 0}
            onChange={(e) => updateTheme({ titleOffsetY: parseFloat(e.target.value) })}
            className="flex-1 accent-indigo-600 dark:accent-indigo-500"
          />
          <span className="text-[10px] font-bold text-indigo-900/70 dark:text-slate-500 uppercase">Turun</span>
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 w-10 text-right bg-white/50 dark:bg-white/10 py-1 px-2 rounded">
            {displayTheme.titleOffsetY ?? 0}%
          </span>
        </div>
      </div>

      {/* Geser Posisi Lirik */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          ↕️ Geser Posisi Lirik (Naik/Turun)
        </label>
        <div className="flex items-center gap-3 bg-white/40 dark:bg-black/20 p-3 rounded-xl border border-indigo-100 dark:border-white/5">
          <span className="text-[10px] font-bold text-indigo-900/70 dark:text-slate-500 uppercase">Naik</span>
          <input
            type="range"
            min="-15" max="15" step="1"
            value={displayTheme.contentOffsetY ?? 0}
            onChange={(e) => updateTheme({ contentOffsetY: parseFloat(e.target.value) })}
            className="flex-1 accent-indigo-600 dark:accent-indigo-500"
          />
          <span className="text-[10px] font-bold text-indigo-900/70 dark:text-slate-500 uppercase">Turun</span>
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 w-10 text-right bg-white/50 dark:bg-white/10 py-1 px-2 rounded">
            {displayTheme.contentOffsetY ?? 0}%
          </span>
        </div>
      </div>

      {/* Rasio Aspek */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          🖥️ Rasio Aspek Layar Jemaat
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([['full', 'Penuh (Default)'], ['16:9', '16:9 (1920x1080)'], ['16:10', '16:10 (1920x1200)'], ['4:3', '4:3 (1024x768)']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateTheme({ aspectRatio: val })}
              className={`py-2 rounded-xl font-bold text-xs border-2 transition-all ${(displayTheme.aspectRatio || 'full') === val ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Kegelapan Latar Belakang (Dark Overlay & Vignette) */}
      <div className="p-3 bg-indigo-50/60 dark:bg-slate-800/60 rounded-2xl border border-indigo-200 dark:border-slate-700 flex flex-col gap-3">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
              🌑 Lapisan Gelap Latar (Dark Overlay)
            </label>
            <span className="text-xs font-bold text-indigo-600 dark:text-amber-400">
              {displayTheme.backgroundDim !== undefined ? displayTheme.backgroundDim : 40}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-bold">0% (Terang)</span>
            <input
              type="range"
              min={0} max={90} step={5}
              value={displayTheme.backgroundDim !== undefined ? displayTheme.backgroundDim : 40}
              onChange={(e) => updateTheme({ backgroundDim: parseInt(e.target.value, 10) })}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-[10px] text-slate-500 font-bold">90% (Gelap)</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-indigo-100 dark:border-slate-700">
          <div>
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">🎬 Bayangan Tepi Sinematik (Vignette)</div>
            <div className="text-[10px] text-slate-500">Meredupkan sudut layar agar teks lebih kontras</div>
          </div>
          <button
            type="button"
            onClick={() => updateTheme({ enableVignette: !displayTheme.enableVignette })}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${displayTheme.enableVignette
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
              }`}
          >
            {displayTheme.enableVignette ? 'Aktif' : 'Mati'}
          </button>
        </div>
      </div>

      {/* Gambar Blank & Logo */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 block">
          🖼️ Pengaturan Layar Blank (B) & Logo (L)
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card Layar Blank */}
          <div className="p-3 rounded-2xl border-2 border-indigo-100 dark:border-slate-800 bg-white/60 dark:bg-slate-800/50 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-900 dark:bg-slate-100"></span>
                Layar Blank (B)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {displayTheme.blankImageUrl === 'none'
                  ? 'Hitam Polos'
                  : displayTheme.blankImageUrl
                    ? 'Gambar Kustom'
                    : 'Logo Bawaan'}
              </span>
            </div>

            {/* Thumbnail Preview */}
            <div className="h-16 w-full rounded-xl bg-black border border-slate-700/60 flex items-center justify-center overflow-hidden relative">
              {displayTheme.blankImageUrl === 'none' ? (
                <span className="text-[11px] font-mono text-slate-400 italic">Hitam Polos (Tanpa Gambar)</span>
              ) : (
                <img
                  src={displayTheme.blankImageUrl || import.meta.env.BASE_URL + "blank_logo.png"}
                  alt="Blank Preview"
                  className={displayTheme.blankImageFit === 'cover' ? "w-full h-full object-cover" : "max-h-12 max-w-[80%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] drop-shadow-[0_0_15px_rgba(197,160,89,0.45)]"}
                />
              )}
            </div>

            {/* Pilihan Ukuran Gambar Blank */}
            {displayTheme.blankImageUrl !== 'none' && (
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-black/5 dark:bg-black/30 border border-slate-200 dark:border-slate-700/60 text-[10px]">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Ukuran:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => updateTheme({ blankImageFit: 'contain' })}
                    className={`px-2 py-0.5 rounded font-bold transition ${displayTheme.blankImageFit !== 'cover' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Logo Tengah (50%)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateTheme({ blankImageFit: 'cover' })}
                    className={`px-2 py-0.5 rounded font-bold transition ${displayTheme.blankImageFit === 'cover' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Layar Penuh
                  </button>
                </div>
              </div>
            )}

            {/* Tombol Aksi Layar Blank */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <input type="file" accept="image/*" ref={blankInputRef} onChange={onBlankUpload} className="hidden" />
              <button
                type="button"
                onClick={() => blankInputRef.current?.click()}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1 shadow-sm"
              >
                <ImageIcon size={12} />
                Ganti Gambar
              </button>

              {displayTheme.blankImageUrl !== 'none' ? (
                <button
                  type="button"
                  onClick={onRemoveBlankImage}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition flex items-center justify-center gap-1"
                  title="Hapus gambar agar layar blank menjadi hitam polos murni"
                >
                  <EyeOff size={12} />
                  Hitam Polos
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetBlankImage}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition flex items-center justify-center gap-1"
                  title="Kembalikan ke logo bawaan"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Card Layar Logo (Hotkey L) */}
          <div className="p-3 rounded-2xl border-2 border-indigo-100 dark:border-slate-800 bg-white/60 dark:bg-slate-800/50 flex flex-col justify-between gap-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Layar Logo (L)
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                {displayTheme.logoScreenUrl === 'none'
                  ? 'Dinonaktifkan'
                  : displayTheme.logoScreenUrl
                    ? 'Logo Kustom'
                    : 'Logo Bawaan'}
              </span>
            </div>

            {/* Thumbnail Preview */}
            <div className="h-16 w-full rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-center overflow-hidden relative">
              {displayTheme.logoScreenUrl === 'none' ? (
                <span className="text-[11px] font-mono text-slate-400 italic">Tanpa Logo (Hanya Background)</span>
              ) : (
                <img
                  src={displayTheme.logoScreenUrl || import.meta.env.BASE_URL + "logo.png"}
                  alt="Logo Preview"
                  className="max-h-12 max-w-[80%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.7)] drop-shadow-[0_0_15px_rgba(197,160,89,0.45)]"
                />
              )}
            </div>

            {/* Tombol Aksi Layar Logo */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <input type="file" accept="image/*" ref={logoLInputRef} onChange={onLogoLUpload} className="hidden" />
              <button
                type="button"
                onClick={() => logoLInputRef.current?.click()}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1 shadow-sm"
              >
                <ImageIcon size={12} />
                Ganti Layar Logo
              </button>

              {displayTheme.logoScreenUrl !== 'none' ? (
                <button
                  type="button"
                  onClick={onRemoveLogoL}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 transition flex items-center justify-center gap-1"
                  title="Nonaktifkan logo saat tombol L ditekan"
                >
                  <EyeOff size={12} />
                  Hapus
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResetLogoL}
                  className="py-1.5 px-2 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition flex items-center justify-center gap-1"
                  title="Kembalikan ke logo bawaan"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-2 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-700/60 text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <span>💡</span>
          <span><strong>Tips:</strong> Pengaturan di atas khusus untuk Layar Blank (<strong>B</strong>) dan Layar Logo (<strong>L</strong>). Untuk logo sudut slide (watermark), kelola di tab <strong>"Logo / Watermark"</strong>.</span>
        </div>
      </div>

      {/* Layout Layar (OBS) */}
      <div>
        <label className="text-xs font-bold uppercase tracking-widest text-indigo-900/60 dark:text-indigo-200/50 mb-2 block">
          📋 Layout Tampilan (OBS / Proyektor)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([['full', 'Layar Penuh'], ['lower-third', 'Lower Third (Live Streaming)']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateTheme({ layout: val })}
              className={`py-2 rounded-xl font-bold text-xs border-2 transition-all ${(displayTheme.layout || 'full') === val ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white/50 dark:bg-white/5 text-indigo-900 dark:text-indigo-200 border-white/50 dark:border-white/10 hover:bg-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Pilihan Gaya Lower Third jika Lower Third Aktif */}
      {displayTheme.layout === 'lower-third' && (
        <div className="p-3 bg-indigo-50/60 dark:bg-slate-800/60 rounded-2xl border border-indigo-200 dark:border-slate-700 flex flex-col gap-2">
          <label className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
            🎭 Gaya Kotak Lower Third
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['dark-glass', 'Kaca Gelap (Glass)'],
              ['gradient', 'Gradien Halus'],
              ['minimal', 'Minimalis Transparan'],
              ['solid', 'Hitam Pekat']
            ] as const).map(([styleKey, styleLabel]) => (
              <button
                key={styleKey}
                onClick={() => updateTheme({ lowerThirdStyle: styleKey })}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${(displayTheme.lowerThirdStyle || 'dark-glass') === styleKey
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white'
                  }`}
              >
                {styleLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={() => updateTheme({
          color: '#ffffff',
          fontSizeOffset: 0,
          headerTitleFontSizeOffset: 0.5,
          position: 'center',
          bold: true,
          shadow: 'dark',
          transitionStyle: 'crossfade',
          aspectRatio: 'full',
          layout: 'full',
          lowerThirdStyle: 'dark-glass',
          lineHeight: 1.16,
          titleOffsetY: 0,
          contentOffsetY: 0,
          backgroundDim: 40,
          enableVignette: false
        })}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-300 dark:border-slate-600 text-xs font-bold text-indigo-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-white/5 transition-all mt-2"
      >
        ↺ Reset ke Pengaturan Standar
      </button>
    </div>
  );
};
