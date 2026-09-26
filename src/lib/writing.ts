import { getCollection } from 'astro:content';
import { sections, type Kind } from '../site.config';
import { url } from './url';

export async function getWriting(kind: Kind) {
  const all = await getCollection('writing', (e) => e.data.kind === kind);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function writingUrl(kind: Kind, id: string) {
  return url(`/${sections[kind].path}/${id}/`);
}

export function formatDate(date: Date, lang: 'ko' | 'en') {
  return date.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
