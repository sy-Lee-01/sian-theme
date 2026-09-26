import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { kinds } from './site.config';

// 문서: 볼트의 글 노트 (한국어)
const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    kind: z.enum(kinds),
    title: z.string(),
    date: z.coerce.date(),
  }),
});

// 레코드: 실적 목록 (영어)
const publications = defineCollection({
  loader: file('src/content/records/publications.yml'),
  schema: z.object({
    title: z.string(),
    link: z.string().url(),
    description: z.string(),
    venue: z.string(),
  }),
});

const activities = defineCollection({
  loader: file('src/content/records/activities.yml'),
  schema: z.object({
    section: z.string(),
    period: z.string(),
    text: z.string(),
    description: z.string().optional(),
    link: z.string().url().optional(),
  }),
});

export const collections = { writing, publications, activities };
