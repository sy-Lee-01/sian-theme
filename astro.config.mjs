import { defineConfig } from 'astro/config';

// 사이트 주소. 도메인을 연결하면 이 두 줄만 바꾼다:
//   SITE = 'https://sian.io', BASE = '/'
const SITE = 'https://sy-Lee-01.github.io';
const BASE = '/sian-theme';

export default defineConfig({
  site: SITE,
  base: BASE,
});
