import { uploadToR2 } from '@/lib/r2';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Validates an uploaded image and stores it in R2. Returns the key, null if no file, or an error message.
export async function uploadPaymentImage(file: File | null, folder: string, label: string): Promise<{ key?: string | null; error?: string }> {
  if (!file || file.size === 0) return { key: null };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: `${label} must be a JPEG, PNG, or WebP image.` };
  if (file.size > MAX_FILE_SIZE) return { error: `${label} is too large (max 5MB).` };
  return { key: await uploadToR2(file, folder) };
}

export function serializePaymentMethod(m: {
  id: string; name: string; accountName: string; accountNumber: string;
  qrImageUrl: string | null; logoUrl: string | null; isActive: boolean;
}) {
  return {
    id: m.id, name: m.name, accountName: m.accountName, accountNumber: m.accountNumber,
    qrImageUrl: m.qrImageUrl, logoUrl: m.logoUrl, isActive: m.isActive,
  };
}
