import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Trash2, Video } from 'lucide-react';
import { getAllSlideBackgrounds, saveSlideBackground, saveVideoBackground, compressImage } from '../utils/imageStorage';

interface DriveImage {
  id: string;
  url: string;
  name?: string;
  type?: 'image' | 'video';
}

interface BackgroundPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string | null) => void; // null means remove
  currentBgUrl?: string | null;
}

const PRESET_BACKGROUNDS: DriveImage[] = Array.from({ length: 20 }, (_, i) => {
  const num = (i + 1).toString().padStart(2, '0');
  const names = [
    'Ocean Depths', 'Royal Purple', 'Holy Fire', 'Midnight City', 'Crimson Blood',
    'Golden Sunrise', 'Forest Green', 'Heavenly Light', 'Dark Slate', 'Calm Water',
    'Cross Center', 'Morning Sky', 'Warm Praise', 'Starry Night', 'Mountains',
    'Soft Beige', 'Glowing Center', 'Dark Elegant', 'Hopeful Light', 'Vintage Worship'
  ];
  const fileNames = [
    'ocean_depths', 'royal_purple', 'holy_fire', 'midnight_city', 'crimson_blood',
    'golden_sunrise', 'forest_green', 'heavenly_light', 'dark_slate', 'calm_water',
    'cross_center', 'morning_sky', 'warm_praise', 'starry_night', 'mountains',
    'soft_beige', 'glowing_center', 'dark_elegant', 'hopeful_light', 'vintage_worship'
  ];
  return {
    id: `preset_bg_${num}`,
    name: names[i],
    url: `${import.meta.env.BASE_URL}backgrounds/bg_${num}_${fileNames[i]}.svg`
  };
});

PRESET_BACKGROUNDS.push(
  { id: 'preset_bg_lagusion_456', name: 'SDAH 456', url: 'https://play.lagusion.org/assets/gambar/SDAH456_result.webp' },
  { id: 'preset_bg_lagusion_273', name: 'SDAH 273', url: 'https://play.lagusion.org/assets/gambar/SDAH273_result.webp' },
  { id: 'preset_bg_lagusion_426', name: 'SDAH 426', url: 'https://play.lagusion.org/assets/gambar/SDAH426_result.webp' }
);

export function BackgroundPickerInline({ onSelect, currentBgUrl }: Omit<BackgroundPickerModalProps, 'isOpen' | 'onClose'>) {
  const [images, setImages] = useState<DriveImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const results = await getAllSlideBackgrounds();
      setImages(results as DriveImage[]);
    } catch (err: any) {
      setErrorMsg('Gagal memuat galeri gambar: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    try {
      let newId;
      if (file.type.startsWith('video/')) {
        newId = `slide_bg_vid_${Date.now()}`;
        await saveVideoBackground(newId, file);
      } else {
        const dataUrl = await compressImage(file);
        newId = `slide_bg_${Date.now()}`;
        await saveSlideBackground(newId, dataUrl);
      }
      
      onSelect(newId);
      loadImages();
    } catch (err: any) {
      setErrorMsg('Error upload: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-white/5 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700">
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 text-red-200 rounded-xl text-sm">
            {errorMsg}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <label className={`flex-1 py-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition ${isUploading ? 'border-[#C5A059]/50 bg-[#C5A059]/10 opacity-70' : 'border-slate-600 hover:bg-slate-800 hover:border-[#C5A059]'}`}>
            <input type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={handleUpload} disabled={isUploading} />
            {isUploading ? (
              <>
                <Loader2 size={24} className="text-[#C5A059] mb-2 animate-spin" />
                <span className="text-[#C5A059] font-medium text-xs">Mengunggah...</span>
              </>
            ) : (
              <>
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-slate-200 font-bold text-center text-xs">Unggah Baru</span>
              </>
            )}
          </label>

          <button 
            onClick={() => { onSelect(null); }} 
            className="flex-1 py-4 rounded-xl border border-red-500/30 bg-red-900/20 hover:bg-red-900/40 text-red-400 flex flex-col items-center justify-center transition"
          >
            <Trash2 size={24} className="mb-2" />
            <span className="font-bold text-xs">Hapus Background</span>
          </button>
        </div>

        <button
          onClick={() => onSelect('#00FF00')}
          className={`w-full mb-6 py-3 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition-all ${currentBgUrl === '#00FF00' ? 'bg-[#00FF00]/20 border-[#00FF00] text-[#00FF00] shadow-[0_0_15px_rgba(0,255,0,0.2)]' : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-[#00FF00]/50 hover:text-[#00FF00]'}`}
        >
          <div className="w-4 h-4 rounded bg-[#00FF00] border border-white/20"></div>
          Gunakan Layar Hijau (Chroma Key / OBS)
        </button>

        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <ImageIcon size={16} className="text-[#C5A059]" /> Background Bawaan (Preset)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {PRESET_BACKGROUNDS.map((img) => (
            <div 
              key={img.id} 
              onClick={() => { onSelect(img.url); }}
              className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 hover:shadow-[0_0_10px_rgba(197,160,89,0.3)] transition-all group ${currentBgUrl === img.url ? 'border-[#C5A059] shadow-md shadow-[#C5A059]/30' : 'border-slate-700'}`}
            >
              <img src={img.url} alt={img.name} className="w-full h-full object-cover bg-slate-900" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                {img.name}
              </div>
              {currentBgUrl === img.url && (
                <div className="absolute inset-0 bg-[#C5A059]/20 flex items-center justify-center">
                  <div className="bg-[#C5A059] text-black px-2 py-1 rounded-full text-[10px] font-extrabold shadow-md">Terpilih</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <ImageIcon size={16} className="text-[#C5A059]" /> Galeri Lokal (Diunggah) {isLoading && <Loader2 size={12} className="animate-spin text-[#C5A059]" />}
        </h3>

        {!isLoading && images.length === 0 && (
          <div className="text-center p-4 text-slate-500 text-xs italic bg-slate-800/50 rounded-xl border border-slate-700">
            Belum ada gambar yang tersimpan.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <div 
              key={img.id} 
              onClick={() => { onSelect(img.id); }}
              className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 hover:shadow-[0_0_10px_rgba(197,160,89,0.3)] transition-all group ${currentBgUrl === img.id ? 'border-[#C5A059] shadow-md shadow-[#C5A059]/30' : 'border-slate-700'}`}
            >
              {img.type === 'video' ? (
                <>
                  <video src={img.url} className="w-full h-full object-cover bg-slate-900" muted loop autoPlay playsInline />
                  <div className="absolute top-1 left-1 bg-black/50 text-[#C5A059] p-1 rounded-md shadow-sm">
                    <Video size={10} />
                  </div>
                </>
              ) : (
                <img src={img.url} alt="Lokal" className="w-full h-full object-cover bg-slate-900" />
              )}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if(confirm('Hapus gambar ini?')) {
                    import('../utils/imageStorage').then(m => {
                      m.removeSlideBackground(img.id).then(loadImages);
                    });
                  }
                }}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <Trash2 size={12} />
              </button>
              {currentBgUrl === img.id && (
                <div className="absolute inset-0 bg-[#C5A059]/20 flex items-center justify-center">
                  <div className="bg-[#C5A059] text-black px-2 py-1 rounded-full text-[10px] font-extrabold shadow-md">Terpilih</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BackgroundPickerModal({ isOpen, onClose, onSelect, currentBgUrl }: BackgroundPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
      <div className="bg-slate-900 backdrop-blur-md rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ImageIcon size={24} className="text-[#C5A059]"/> Pilih Background
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 transition">
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-2">
           <BackgroundPickerInline onSelect={(id) => { onSelect(id); onClose(); }} currentBgUrl={currentBgUrl} />
        </div>
      </div>
    </div>
  );
}
