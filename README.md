# sian-theme

Obsidian 볼트에서 쓰고, publish로 내보내는 연구자 포트폴리오 + 블로그. Astro로 만든다.

## 실행

```bash
npm install
npm run dev      # http://localhost:4321
```

## 구조

- `src/site.config.ts` — 이름, 링크 등 개인 정보는 여기에만
- `src/content/` — 콘텐츠. 볼트에서 publish 스크립트가 채운다 (직접 편집하지 않음)
- `src/pages/` — Home, Experiments, Notes, CV

## 볼트에서 공개하기

```bash
cp .env.example .env.local   # 처음 한 번: VAULT_PATH에 볼트 경로를 적는다
npm run publish              # 볼트 me/ 에서 publish: true 인 것만 가져온다
git diff                     # 무엇이 공개되는지 확인
```

스크립트는 검사를 모두 통과해야만 파일을 쓰고, git은 건드리지 않는다.

## 배포

`main`에 푸시하면 GitHub Actions가 빌드해 GitHub Pages에 올린다 (`.github/workflows/deploy.yml`).
사이트 주소는 `astro.config.mjs`의 `SITE`, `BASE` 두 줄로 정한다.
