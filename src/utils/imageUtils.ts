/**
 * 图片压缩与处理工具
 * 将图片压缩为 base64 存储到 IndexedDB
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const QUALITY = 0.7;

/**
 * 从 File 对象压缩图片并返回 base64 字符串
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // 等比缩放
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * 从 input file 事件获取压缩后的图片
 */
export async function getImageFromFileInput(event: React.ChangeEvent<HTMLInputElement>): Promise<string | null> {
  const file = event.target.files?.[0];
  if (!file) return null;
  return compressImage(file);
}
