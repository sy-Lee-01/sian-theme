// 개인 정보는 이 파일에만 둔다. 레이아웃 코드에는 직접 적지 않는다.
import sectionsJson from './sections.json';

export const site = {
  name: 'Sian',
  description: 'HCI researcher studying how people work with generative AI.',
  links: [
    { label: 'Email', href: 'mailto:hello@example.com' },
    { label: 'GitHub', href: 'https://github.com/example' },
    { label: 'Google Scholar', href: 'https://scholar.google.com' },
  ],
};

// 글 섹션은 src/sections.json에서 정의한다 (publish 스크립트도 같은 파일을 읽음).
// 순서가 메뉴 순서가 된다.
export const sections = sectionsJson;
export type Kind = keyof typeof sections;
export const kinds = Object.keys(sections) as [Kind, ...Kind[]];
