import { get, set, del, keys } from 'idb-keyval';

export const saveSlideBackground = async (id: string, base64DataUrl: string) => {
  try {
    await set(`slide_bg_${id}`, base64DataUrl);
  } catch (e) {
    console.warn("IndexedDB save failed:", e);
    throw new Error("Browser memblokir penyimpanan lokal (mungkin mode Private/Incognito).");
  }
};

export const saveVideoBackground = async (id: string, fileBlob: Blob) => {
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

// Helper untuk kompresi gambar sebelum disimpan agar IndexedDB tidak terlalu besar
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
        // Compress ke JPEG kualitas 0.8 (sekitar 100-300kb)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

// ==========================================
// FUNGSI UNTUK PENYIMPANAN VIDEO LOKAL (BLOB)
// ==========================================

export const saveLocalVideo = async (id: string, fileBlob: Blob) => {
  await set(`local_vid_${id}`, fileBlob);
};

export const getLocalVideo = async (id: string): Promise<Blob | undefined> => {
  if (id.startsWith('local_vid_')) {
    return await get(id);
  }
  return await get(`local_vid_${id}`);
};

export const removeLocalVideo = async (id: string) => {
  if (id.startsWith('local_vid_')) {
    await del(id);
  } else {
    await del(`local_vid_${id}`);
  }
};
