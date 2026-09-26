# Mdir4

Keyboard-first 듀얼 패널 파일 관리자 (Windows / macOS / Linux).
WinM 4.5의 UX 패러다임(MDir 계승)을 현대 크로스플랫폼 데스크톱으로 재구현합니다.

- 분석 리포트: `../your_files/winm-clone/winm-analysis-report.md`
- 개발 계획서: `../your_files/winm-clone/winm-dev-plan.md`
- 원본 메뉴 레퍼런스: `docs/reference/winm-menus.png`

## 스택

- **Tauri 2** + **Rust** (파일 I/O, 아카이브, 검색 — 네이티브 속도)
- **React** + **TypeScript** + **Vite** (UI)

## 소스에서 개발 · 빌드

### 1. 사전 준비

- Node.js 20+
- Rust stable ([rustup](https://rustup.rs)으로 설치)
- OS별 추가 패키지
  - Linux (Ubuntu/Debian): `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: WebView2 (보통 기본 설치됨) + MSVC 빌드 도구

### 2. 소스 받기

git clone:

```sh
git clone https://github.com/voidnoble/mdir4.git
cd mdir4
```

또는 [릴리스 페이지](https://github.com/voidnoble/mdir4/releases)의 소스 tar.gz를 받아 압축 해제:

```sh
tar xzf mdir4-1.0.0.tar.gz
cd mdir4-1.0.0
```

### 3. 의존성 설치

```sh
npm install
```

### 4. 개발 실행 (핫 리로드)

```sh
npm run tauri dev
```

### 5. 로컬 빌드 (OS별 설치 파일 생성)

```sh
npm run tauri build
```

산출물 위치: `src-tauri/target/release/bundle/`

| OS | 산출물 |
|---|---|
| macOS | `dmg/*.dmg`, `macos/*.app` |
| Windows | `nsis/*-setup.exe`, `msi/*.msi` |
| Linux | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |

### 부분 검증

```sh
npm run build              # TypeScript 컴파일 + Vite 빌드
cd src-tauri && cargo test # Rust 통합 테스트
cd src-tauri && cargo check # Rust 컴파일 검증
```

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

## 라이센스

Mdir4는 [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) 라이센스로 배포됩니다.
상업적 이용이 가능하며, 수정한 버전을 배포할 때는 소스 코드를 함께 공개해야 합니다.
