import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { getAllSlideBackgrounds, saveSlideBackground, compressImage } from '../utils/imageStorage';

interface DriveImage {
  id: string;
  url: string;
  name?: string;
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
    url: `/backgrounds/bg_${num}_${fileNames[i]}.svg`
  };
});

export function BackgroundPickerModal({ isOpen, onClose, onSelect, currentBgUrl }: BackgroundPickerModalProps) {
  const [images, setImages] = useState<DriveImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

  const loadImages = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const results = await getAllSlideBackgrounds();
      setImages(results);
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
      const dataUrl = await compressImage(file);
      const newId = `slide_bg_${Date.now()}`;
      await saveSlideBackground(newId, dataUrl);
      
      onSelect(newId); // Simpan ID-nya saja ke rundown, bukan base64 (agar hemat database)
      onClose();
    } catch (err: any) {
      setErrorMsg('Error upload: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20">
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-indigo-100/50">
          <h2 className="text-xl md:text-2xl font-bold text-indigo-950 flex items-center gap-2">
            <ImageIcon size={24} /> Pilih Background Slide
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 rounded-full text-indigo-900 transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-xl text-sm">
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <label className={`flex-1 glass-button py-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition ${isUploading ? 'border-indigo-300 bg-indigo-50 opacity-70' : 'border-indigo-400 hover:bg-indigo-50 hover:border-indigo-500'}`}>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isUploading} />
              {isUploading ? (
                <>
                  <Loader2 size={32} className="text-indigo-500 mb-2 animate-spin" />
                  <span className="text-indigo-600 font-medium">Mengunggah...</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-indigo-500 mb-2" />
                  <span className="text-indigo-900 font-bold">Unggah Gambar Baru</span>
                  <span className="text-slate-500 text-sm">Disimpan di memori browser ini</span>
                </>
              )}
            </label>

            <button 
              onClick={() => { onSelect(null); onClose(); }} 
              className="flex-1 glass-button py-4 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 flex flex-col items-center justify-center transition"
            >
              <Trash2 size={32} className="mb-2" />
              <span className="font-bold">Hapus Background</span>
              <span className="text-sm">Gunakan background global</span>
            </button>
          </div>

          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            Galeri Drive {isLoading && <Loader2 size={16} className="animate-spin text-indigo-500" />}
          </h3>

          {/* Galeri Preset (Bawaan) */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <ImageIcon size={20} className="text-indigo-500" /> Background Bawaan (Preset)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {PRESET_BACKGROUNDS.map((img) => (
                <div 
                  key={img.id} 
                  onClick={() => { onSelect(img.url); onClose(); }}
                  className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 hover:shadow-lg transition-all hover:scale-105 group ${currentBgUrl === img.url ? 'border-green-500 shadow-md shadow-green-500/30' : 'border-transparent'}`}
                >
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover bg-slate-900" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.name}
                  </div>
                  {currentBgUrl === img.url && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-md">Terpilih</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <ImageIcon size={20} className="text-indigo-500" /> Galeri Lokal (Diunggah)
          </h3>

          {!isLoading && images.length === 0 && (
            <div className="text-center p-8 text-slate-500 italic bg-white/50 rounded-xl border border-slate-200">
              Belum ada gambar yang tersimpan di perangkat ini.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((img) => (
              <div 
                key={img.id} 
                onClick={() => { onSelect(img.id); onClose(); }}
                className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 hover:shadow-lg transition-all hover:scale-105 group ${currentBgUrl === img.id ? 'border-green-500 shadow-md shadow-green-500/30' : 'border-transparent'}`}
              >
                <img src={img.url} alt="Background Lokal" className="w-full h-full object-cover bg-slate-900" />
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if(confirm('Hapus gambar ini dari memori lokal?')) {
                      import('../utils/imageStorage').then(m => {
                        m.removeSlideBackground(img.id).then(loadImages);
                      });
                    }
                  }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Hapus dari memori"
                >
                  <Trash2 size={14} />
                </button>
                {currentBgUrl === img.id && (
                  <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">Terpilih</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
