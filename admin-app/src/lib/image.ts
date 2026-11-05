// Préparation des images avant envoi : vérification du type réel, redimensionnement, conversion WebP.
export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 2400;

/** Type détecté d'après les premiers octets (le type déclaré par le navigateur n'est pas fiable). */
export async function sniff(file: Blob): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const s = (i: number, str: string) => str.split('').every((c, j) => b[i + j] === c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && s(1, 'PNG')) return 'image/png';
  if (s(0, 'GIF8')) return 'image/gif';
  if (s(0, 'RIFF') && s(8, 'WEBP')) return 'image/webp';
  if (s(4, 'ftypavif') || s(4, 'ftypavis')) return 'image/avif';
  return null;
}

export type Prepared = { blob: Blob; mime: string; width: number; height: number; ext: string; originalBytes: number };
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * @param targetMime type imposé (remplacement d'un fichier existant) ; sinon WebP si le navigateur sait l'encoder.
 */
export async function prepareImage(file: File, targetMime?: string): Promise<Prepared> {
  const real = await sniff(file);
  if (!real || !ACCEPTED.includes(real)) throw new Error('Format refusé : seules les images JPEG, PNG, WebP, AVIF et GIF sont acceptées.');
  if (file.size > MAX_BYTES * 3) throw new Error('Fichier trop volumineux (30 Mo maximum avant optimisation).');
  const img = await loadImage(file);
  const w = img.naturalWidth; const h = img.naturalHeight;
  // GIF (animations) et AVIF : conservés tels quels, le navigateur ne sait pas les réencoder fidèlement.
  if (real === 'image/gif' || real === 'image/avif') {
    if (targetMime && targetMime !== real) throw new Error(`Le fichier de remplacement doit être au format ${EXT[targetMime].toUpperCase()}.`);
    if (file.size > MAX_BYTES) throw new Error('Fichier trop volumineux (10 Mo maximum).');
    return { blob: file, mime: real, width: w, height: h, ext: EXT[real], originalBytes: file.size };
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cw = Math.round(w * scale); const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
  const want = targetMime ?? 'image/webp';
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, want, 0.86));
  let out = blob && blob.type === want ? blob : null;
  let mime = want;
  if (!out) {
    if (targetMime) throw new Error('Votre navigateur ne sait pas produire ce format.');
    out = file; mime = real; // pas d'encodeur WebP : on garde l'original
  }
  // Ne jamais alourdir : si l'original (dans le même format) est plus léger et non redimensionné, on le garde.
  if (scale === 1 && real === mime && file.size <= out.size) out = file;
  if (out.size > MAX_BYTES) throw new Error('Image trop lourde même après optimisation (10 Mo maximum).');
  return { blob: out, mime, width: scale === 1 ? w : cw, height: scale === 1 ? h : ch, ext: EXT[mime], originalBytes: file.size };
}

export function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'image';
}
