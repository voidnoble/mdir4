[한국어](README.md) | English

# Mdir4

Keyboard-first dual-panel file manager (Windows / macOS / Linux).
Reimplements the UX paradigm of WinM 4.5 (inheriting MDir) as a modern cross-platform desktop app.

- Analysis report: `../your_files/winm-clone/winm-analysis-report.md`
- Development plan: `../your_files/winm-clone/winm-dev-plan.md`
- Original menu reference: `docs/reference/winm-menus.png`

## Stack

- **Tauri 2** + **Rust** (file I/O, archives, search — native speed)
- **React** + **TypeScript** + **Vite** (UI)

## Develop & Build from Source

### 1. Prerequisites

- Node.js 20+
- Rust stable (install via [rustup](https://rustup.rs))
- Additional OS-specific packages
  - Linux (Ubuntu/Debian): `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - macOS: Xcode Command Line Tools (`xcode-select --install`)
  - Windows: WebView2 (usually preinstalled) + MSVC build tools

### 2. Get the source

git clone:

```sh
git clone https://github.com/voidnoble/mdir4.git
cd mdir4
```

Or download the source tar.gz from the [releases page](https://github.com/voidnoble/mdir4/releases) and extract it:

```sh
tar xzf mdir4-1.0.0.tar.gz
cd mdir4-1.0.0
```

### 3. Install dependencies

```sh
npm install
```

### 4. Run in dev mode (hot reload)

```sh
npm run tauri dev
```

### 5. Local build (produce OS installers)

```sh
npm run tauri build
```

Artifacts: `src-tauri/target/release/bundle/`

| OS | Artifacts |
|---|---|
| macOS | `dmg/*.dmg`, `macos/*.app` |
| Windows | `nsis/*-setup.exe`, `msi/*.msi` |
| Linux | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |

### Partial verification

```sh
npm run build              # TypeScript compile + Vite build
cd src-tauri && cargo test # Rust integration tests
cd src-tauri && cargo check # Rust compile check
```

## Download

Latest release: [GitHub Releases](https://github.com/voidnoble/mdir4/releases)

> [!NOTE]
> The macOS build is unsigned. Gatekeeper may warn on first launch;
> allow it under `System Settings → Privacy & Security`.
>
> If you get an error like "is damaged and can't be opened", open the Terminal
> app and run the following command to remove the quarantine attribute so it
> can be launched:
>
> ```sh
> xattr -dr com.apple.quarantine /Applications/mdir4.app
> ```

## Structure

```
src-tauri/src/      Rust core (fs/archive/search/config/split/rename/hotkey modules since P1)
src/                React UI (panes/keybar/dialogs/mcd/qcd/theme/i18n)
docs/reference/     Original WinM references
```

## Shortcut principles (keyboard-first)

- Inherits the WinM shortcut scheme (see development plan §3.1)
- Settings: macOS `Cmd+,` / Windows & Linux `Ctrl+F12`

## Roadmap

P0 scaffolding → P1 Rust fs core → P2 dual-panel UI → P3 keybar/shortcuts/dialogs →
P4 MVP release → P5 MCD/QCD/split/batch-rename → P6 v1 release

## License

Mdir4 is distributed under the [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html) license.
Commercial use is permitted; when distributing modified versions, the source code must also be made available.
