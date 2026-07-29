import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Loader2, CheckCircle } from 'lucide-react';
import { callApi } from '../api';

export default function Settings() {
  const navigate = useNavigate();
  const [currentAdminPin, setCurrentAdminPin] = useState('');
  const [newOperatorPin, setNewOperatorPin] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSave = async () => {
    if (!currentAdminPin) {
      setIsError(true);
      setMessage('PIN Admin saat ini harus diisi!');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    try {
      const res = await callApi('updatePins', {}, {
        method: 'POST',
        payload: {
          adminPin: currentAdminPin,
          newOperatorPin: newOperatorPin || undefined,
          newAdminPin: newAdminPin || undefined
        }
      });
      
      if (res && res.success) {
        setIsError(false);
        setMessage('PIN berhasil diperbarui!');
        setCurrentAdminPin('');
        setNewOperatorPin('');
        setNewAdminPin('');
      } else {
        throw new Error(res.error?.message || 'Gagal mengubah PIN.');
      }
    } catch (err: any) {
      setIsError(true);
      setMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex justify-center items-center">
      <div className="glass-panel max-w-2xl w-full p-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="glass-button text-indigo-900 p-2"><ArrowLeft size={20}/></button>
            <h1 className="text-2xl font-bold text-indigo-900">Pengaturan Keamanan</h1>
          </div>
          <button 
            onClick={handleSave} 
            disabled={isLoading || !currentAdminPin}
            className="glass-button bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
            Simpan
          </button>
        </header>

        {message && (
          <div className={`p-4 rounded-xl mb-6 flex items-center gap-2 ${isError ? 'bg-red-500/20 text-red-700 border border-red-500/30' : 'bg-green-500/20 text-green-700 border border-green-500/30'}`}>
            {isError ? <Lock size={20} /> : <CheckCircle size={20} />}
            <span className="font-semibold">{message}</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="bg-white/40 p-6 rounded-xl border border-white/50">
            <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Lock size={18} /> Otorisasi Admin
            </h2>
            <label className="block text-indigo-900 font-semibold mb-2">PIN Admin Saat Ini (Wajib)</label>
            <input 
              type="password" 
              value={currentAdminPin}
              onChange={(e) => setCurrentAdminPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              className="glass-input text-lg tracking-widest font-bold max-w-xs" 
              placeholder="••••••" 
            />
            <p className="text-xs text-indigo-800/60 mt-2">Anda harus memasukkan PIN Admin yang aktif saat ini untuk melakukan perubahan.</p>
          </div>
          
          <div className="bg-white/40 p-6 rounded-xl border border-white/50">
            <h2 className="text-lg font-bold text-indigo-900 mb-4">Ubah PIN</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-indigo-900 font-semibold mb-2">PIN Operator Baru</label>
                <input 
                  type="password" 
                  value={newOperatorPin}
                  onChange={(e) => setNewOperatorPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="glass-input text-lg tracking-widest font-bold" 
                  placeholder="••••••" 
                />
                <p className="text-xs text-indigo-800/60 mt-2">Kosongkan jika tidak ingin mengubah PIN Operator.</p>
              </div>

              <div>
                <label className="block text-indigo-900 font-semibold mb-2">PIN Admin Baru</label>
                <input 
                  type="password" 
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  className="glass-input text-lg tracking-widest font-bold" 
                  placeholder="••••••" 
                />
                <p className="text-xs text-indigo-800/60 mt-2">Kosongkan jika tidak ingin mengubah PIN Admin.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
