import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface HotkeyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HotkeyHelpModal: React.FC<HotkeyHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel w-[90%] max-w-md p-6 relative rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-slate-200 dark:bg-slate-700 rounded-full hover:bg-red-500 hover:text-white transition-all text-slate-500 dark:text-slate-300"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl font-heading font-extrabold text-indigo-950 dark:text-white mb-6 flex items-center gap-2">
          <Keyboard className="text-indigo-600 dark:text-indigo-400" /> Pintasan Keyboard
        </h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Slide / Segmen Berikutnya</span>
            <div className="flex gap-1 flex-wrap justify-end">
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">Spasi</kbd>
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">→</kbd>
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">PgDn</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Slide / Segmen Sebelumnya</span>
            <div className="flex gap-1 flex-wrap justify-end">
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">←</kbd>
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">PgUp</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Layar Gelap (Blank)</span>
            <div className="flex gap-1">
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">B</kbd>
              <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">.</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Tampilan Logo Utama</span>
            <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">L</kbd>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Layar Penuh (Fullscreen)</span>
            <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">F11</kbd>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Tutup Dialog / Batal</span>
            <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-900">Esc</kbd>
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
          Pintasan ini bisa dijalankan dari jarak jauh menggunakan <strong>Wireless Presenter / Laser Pointer</strong> (karena tombol Next/Prev pada alat tersebut setara dengan PageDown/PageUp atau panah).
        </p>
      </div>
    </div>
  );
};
