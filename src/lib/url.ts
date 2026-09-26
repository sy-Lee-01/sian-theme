// 사이트 내부 경로에 base를 붙인다. 링크는 항상 이 함수를 거친다.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (path: string) => base + path;
