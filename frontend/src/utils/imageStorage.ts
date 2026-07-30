import { get, set, del, keys } from 'idb-keyval';

export const saveSlideBackground = async (id: string, base64DataUrl: string) => {
  await set(`slide_bg_${id}`, base64DataUrl);
};

export const getSlideBackground = async (id: string) => {
  if (id.startsWith('slide_bg_')) {
    return await get(id);
  }
  return await get(`slide_bg_${id}`);
};

export const removeSlideBackground = async (id: string) => {
  if (id.startsWith('slide_bg_')) {
    await del(id);
  } else {
    await del(`slide_bg_${id}`);
  }
};

export const getAllSlideBackgrounds = async () => {
  const allKeys = await keys();
  const bgKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('slide_bg_')) as string[];
  
  const results = [];
  for (const k of bgKeys) {
    const dataUrl = await get(k);
    results.push({ id: k, url: dataUrl });
  }
  return results;
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
