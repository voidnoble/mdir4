# Mdir4

Keyboard-first 듀얼 패널 파일 관리자 (Windows / macOS / Linux).
WinM 4.5의 UX 패러다임(MDir 계승)을 현대 크로스플랫폼 데스크톱으로 재구현합니다.

- 분석 리포트: `../your_files/winm-clone/winm-analysis-report.md`
- 개발 계획서: `../your_files/winm-clone/winm-dev-plan.md`
- 원본 메뉴 레퍼런스: `docs/reference/winm-menus.png`

## 스택

- **Tauri 2** + **Rust** (파일 I/O, 아카이브, 검색 — 네이티브 속도)
- **React** + **TypeScript** + **Vite** (UI)

## 개발

```sh
npm install
npm run tauri dev      # 개발 실행
npm run tauri build    # OS별 번들 빌드
```

Rust만 검증: `cd src-tauri && cargo check`
프론트엔드만 검증: `npm run build`

## 다운로드

최신 릴리스: [GitHub Releases](https://github.com/voidnoble/mdir4/releases)

> [!NOTE]
> macOS 빌드는 미서명 상태입니다. 처음 실행 시 Gatekeeper 경고가 나올 수 있으며,
> `시스템 설정 → 개인정보 보호 및 보안`에서 허용하면 실행됩니다.

## 구조

```
src-tauri/src/      Rust 코어 (P1부터 fs/archive/search/config/split/rename/hotkey 모듈)
src/                React UI (panes/keybar/dialogs/mcd/qcd/theme/i18n)
docs/reference/     WinM 원본 레퍼런스
```

## 단축키 원칙 (keyboard-first)

- WinM 단축키 체계 계승 (개발 계획서 §3.1)
- 환경설정: macOS `Cmd+,` / Windows·Linux `Ctrl+F12`

## 로드맵

P0 스캐폴딩 → P1 Rust fs 코어 → P2 듀얼 패널 UI → P3 키바/단축키/다이얼로그 →
P4 MVP 릴리스 → P5 MCD/QCD/분할/고급이름바꾸기 → P6 v1 릴리스
