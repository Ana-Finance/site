import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

// Inter embarquée localement (public/fonts) : aucun accès réseau requis au rendu.
export const fontFamily = 'Inter';

const WEIGHTS = ['400', '500', '600', '700', '800'];

for (const weight of WEIGHTS) {
  loadFont({
    family: fontFamily,
    url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`),
    weight,
    format: 'woff2',
  });
}
