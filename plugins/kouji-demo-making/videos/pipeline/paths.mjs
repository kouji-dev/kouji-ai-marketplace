import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIDEOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(VIDEOS, '..');
export const OUT = path.join(VIDEOS, 'out');
export const MEDIA = path.join(REPO, 'docs-site', 'media');
