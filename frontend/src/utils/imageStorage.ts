import { get, set, del, keys } from 'idb-keyval';

// @ts-ignore
const hasElectron = typeof window !== 'undefined' && !!window.electronAPI;

// Fungsi helper panggil IPC
const callIpc = async (action: string, payload: any) => {
  // @ts-ignore
  if (hasElectron) return window.electronAPI.callApi(action, {}, { method: 'POST', payload });
  throw new Error("Bukan environment Electron");
};

export const saveSlideBackground = async (id: string, base64DataUrl: string) => {
  if (hasElectron) {
    await callIpc('saveMediaFile', { id, dataUrl: base64DataUrl, type: 'image' });
    return;
  }
  try {
    await set(`slide_bg_${id}`, base64DataUrl);
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
    throw new Error("Browser memblokir penyimpanan lokal (mungkin mode Private/Incognito).");
  }
};

export const saveVideoBackground = async (id: string, fileBlob: Blob | File) => {
  if (hasElectron) {
    // Jika fileBlob adalah File (punya path fisik), kirim path-nya agar lebih cepat di copy
    const file = fileBlob as any;
    if (file.path) {
      await callIpc('saveMediaFile', { id, filePath: file.path, type: 'video' });
      return;
    }
    // Jika Blob biasa, kita ubah jadi base64/dataURL dulu
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(fileBlob);
    });
    await callIpc('saveMediaFile', { id, dataUrl, type: 'video' });
    return;
  }
  
  try {
    if (id.startsWith('slide_bg_vid_')) {
      await set(id, fileBlob);
    } else {
      await set(`slide_bg_vid_${id}`, fileBlob);
    }
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
    throw new Error("Browser memblokir penyimpanan lokal (mungkin mode Private/Incognito).");
  }
};

export const getSlideBackground = async (id: string) => {
  if (hasElectron) {
    // Di Electron, cari ID ini di daftar media, kembalikan URL file:// nya
    const list = await getAllSlideBackgrounds();
    const item = list.find((i: any) => i.id === id);
    if (item) return item.url;
    return undefined;
  }
  
  try {
    if (id.startsWith('slide_bg_vid_') || id.startsWith('slide_bg_')) {
      return await get(id);
    }
    return await get(`slide_bg_${id}`);
  } catch (e) {
    console.warn("IndexedDB get failed:", e);
    return undefined;
  }
};

export const removeSlideBackground = async (id: string) => {
  if (hasElectron) {
    await callIpc('deleteMediaFile', { id });
    // Tetap coba hapus di indexedDB sekadar jaga-jaga
  }
  try {
    if (id.startsWith('slide_bg_vid_') || id.startsWith('slide_bg_')) {
      await del(id);
    } else {
      await del(`slide_bg_${id}`);
    }
  } catch (e) {
    console.warn("IndexedDB delete failed:", e);
  }
};

export const getAllSlideBackgrounds = async () => {
  if (hasElectron) {
    const res = await callIpc('listMediaFiles', {});
    if (res && res.success) return res.data;
    return [];
  }
  
  try {
    const allKeys = await keys();
    const bgKeys = allKeys.filter(k => typeof k === 'string' && (k.startsWith('slide_bg_') || k.startsWith('slide_bg_vid_'))) as string[];
    
    const results = [];
    for (const k of bgKeys) {
      const data = await get(k);
      if (k.startsWith('slide_bg_vid_') && data instanceof Blob) {
        results.push({ id: k, url: URL.createObjectURL(data), type: 'video' });
      } else {
        results.push({ id: k, url: data as string, type: 'image' });
      }
    }
    return results;
  } catch (e) {
    console.warn("IndexedDB not available or failed:", e);
    return [];
  }
};

// Helper untuk kompresi gambar
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export const saveLocalVideo = async (id: string, fileBlob: Blob | File) => {
  if (hasElectron) {
    const file = fileBlob as any;
    if (file.path) {
      await callIpc('saveMediaFile', { id: `local_vid_${id}`, filePath: file.path, type: 'video' });
      return;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(fileBlob);
    });
    await callIpc('saveMediaFile', { id: `local_vid_${id}`, dataUrl, type: 'video' });
    return;
  }
  await set(`local_vid_${id}`, fileBlob);
};

export const getLocalVideo = async (id: string): Promise<Blob | undefined> => {
  if (id.startsWith('local_vid_')) {
    return await get(id);
  }
  return await get(`local_vid_${id}`);
};

export const removeLocalVideo = async (id: string) => {
  if (hasElectron) {
    await callIpc('deleteMediaFile', { id: id.startsWith('local_vid_') ? id : `local_vid_${id}` });
  }
  if (id.startsWith('local_vid_')) {
    await del(id);
  } else {
    await del(`local_vid_${id}`);
  }
};

export const saveLocalImage = async (id: string, fileBlob: Blob | File) => {
  if (hasElectron) {
    const file = fileBlob as any;
    // In Electron, File objects from <input type="file"> always have a .path property
    if (file.path) {
      await callIpc('saveMediaFile', { id: `local_img_${id}`, filePath: file.path, type: 'image' });
      return;
    }
    // Fallback: convert to base64 (slow, but safe)
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(fileBlob);
    });
    await callIpc('saveMediaFile', { id: `local_img_${id}`, dataUrl, type: 'image', mimeType: fileBlob.type });
    return;
  }
  await set(`local_img_${id}`, fileBlob);
};

export const getLocalImage = async (id: string): Promise<Blob | string | undefined> => {
  try {
    if (id.startsWith('local_img_')) {
      return await get(id);
    }
    return await get(`local_img_${id}`);
  } catch (e) {
    console.warn("Failed to get local image", e);
    return undefined;
  }
};
