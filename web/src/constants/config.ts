export const API_BASE_URL = 'http://localhost:5000/api/v1';

export function getFullImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  const cleanPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  const baseUrl = API_BASE_URL.replace('/api/v1', '');
  return `${baseUrl}${cleanPath}`;
}

