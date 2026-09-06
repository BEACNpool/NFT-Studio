export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const assetPath = (path: string) => BASE_PATH + path;
