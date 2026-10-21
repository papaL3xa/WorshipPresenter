import React from 'react';
import { X, Loader2, CheckCircle, Plus, Video, Link2, Film } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrlInput: string;
  setVideoUrlInput: (url: string) => void;
  videoTitle?: string;
  setVideoTitle?: (title: string) => void;
  isVideoUploading: boolean;
  isVideoLoop: boolean;
  isVideoMuted: boolean;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsVideoLoop: (loop: boolean) => void;
  setIsVideoMuted: (muted: boolean) => void;
  onSubmit: () => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  videoUrlInput,
  setVideoUrlInput,
  videoTitle,
  setVideoTitle,
  isVideoUploading,
  isVideoLoop,
  isVideoMuted,
  onVideoUpload,
  setIsVideoLoop,
  setIsVideoMuted,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const isLocalFileSelected = videoUrlInput.startsWith('local_vid_') || videoUrlInput.startsWith('file://');

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl max-w-xl w-full border border-white/50 dark:border-slate-700/60 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-2 transition-all z-20"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-indigo-900 dark:text-[#C5A059] mb-4 flex items-center gap-2">
          <Video size={22} /> Tambahkan Video
        </h2>

        <div className="space-y-4">
          {/* Judul Video Opsional */}
          {setVideoTitle && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Judul Item Video (Opsional)
              </label>
              <input
                type="text"
                value={videoTitle || ''}
                onChange={(e) => setVideoTitle(e.target.value)}
                placeholder="Contoh: Video Klip Pembuka, Kesaksian, dll."
                className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-indigo-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-all"
              />
            </div>
          )}

          {/* Opsi 1: Masukkan URL / Link Video */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Link2 size={15} /> Link Video YouTube / URL Langsung
            </label>
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... atau https://...mp4"
              className="w-full bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-indigo-900 dark:text-white font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ATAU PILIH FILE DARI KOMPUTER</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          {/* Opsi 2: Upload File Video Lokal */}
          <div>
            <input
              type="file"
              accept="video/*"
              id="cp-video-file-upload"
              className="hidden"
              onChange={onVideoUpload}
            />
            <label
              htmlFor="cp-video-file-upload"
              className={`cursor-pointer flex justify-center items-center gap-2 w-full p-4 rounded-2xl border-2 border-dashed transition-all font-semibold text-sm ${isVideoUploading
                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                : isLocalFileSelected
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {isVideoUploading ? (
                <>
                  <Loader2 size={18} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                  <span>Sedang memproses file video...</span>
                </>
              ) : isLocalFileSelected ? (
                <>
                  <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>File Video Lokal Terpilih! (Klik untuk mengganti)</span>
                </>
              ) : (
                <>
                  <Film size={18} className="text-indigo-600 dark:text-[#C5A059]" />
                  <span>Pilih File Video (MP4, WEBM, MKV)</span>
                </>
              )}
            </label>
          </div>

          {/* Pengaturan Pemutaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <label className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={isVideoLoop}
                onChange={(e) => setIsVideoLoop(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                Ulangi Video (Loop)
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={isVideoMuted}
                onChange={(e) => setIsVideoMuted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none">
                Bisukan Suara (Mute)
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={isVideoUploading || !videoUrlInput.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition-all mt-5 text-sm flex items-center justify-center gap-2"
        >
          Tambahkan Video ke Rundown
        </button>
      </div>
    </div>
  );
};
