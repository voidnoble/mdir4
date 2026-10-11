# WinM → Mdir4 구현 계획 (4-target)

대상: Windows 11 x64 · Linux x64 · Linux arm64 · macOS arm64
기준: [WinM 4.5.591 Beta 기능 명세서](winm-feature-spec.md)

## 1. 구현 상태 매핑 (Mdir4 P0–P6 + 이후 개선 기준)

| 영역 | 상태 |
|---|---|
| 듀얼 패널, 파일 작업(복사/이동/삭제/이름바꾸기/폴더만들기) | ✓ 완료 |
| ZIP 압축/해제/보기 | ✓ 완료 |
| MCD 트리, QCD 북마크 | ✓ 완료 |
| 파일 분할/결합 | ✓ 완료 |
| 일괄 이름바꾸기 (일반/고급) | ✓ 완료 |
| 속성/날짜 대화상자, descript.ion | ✓ 완료 |
| 테마(.col)/언어(.lng) 가져오기 | ✓ 완료 |
| 정렬/필터/빨리 찾기/선택 반전 | ✓ 완료 |
| 드라이브 상자 | ✓ 완료 (F3 DriveDialog) |
| 단축키 표시줄, 툴바 | ✓ 완료 |
| 자동 업데이트 | 미구현 — Tauri updater 연동 필요 |
| 네트워크 드라이브 연결/끊기 | 미구현 — OS별 구현 필요 |
| 인쇄 | 미구현 |
| 도스명령 | 부분 — 외부 명령 실행 기반 있음 |

## 2. 단계별 계획

**Phase A — 릴리즈 기반 (CI)**
- Linux arm64 빌드 추가 (현재 매트릭스에 없음 — ARM 러너 또는 크로스 컴파일)
- 4-target 릴리즈 파이프라인 검증

**Phase B — 기능 갭**
1. 자동 업데이트 (Tauri updater, 2일 주기 확인 로직)
2. 네트워크 드라이브 (Windows: WNet API / Linux: GVfs·SMB / macOS: NetFS)
3. 인쇄 (OS별 인쇄 대화상자 연동)
4. 도스명령/외부 명령어 패널 정리

**Phase C — 릴리즈**
- 버전 결정 (현 0.5.0), 릴리즈 노트, 에셋 큐레이션
- 4-target 빌드 → GitHub Release

## 3. 타겟별 주의사항
- **공통**: Tauri 2가 4개 타겟을 네이티브 지원하므로 아키텍처 이슈 없음
- **Linux arm64**: CI 매트릭스 추가로 해결
- **macOS arm64**: Gatekeeper/quarantine 안내 유지 (README에 문서화됨)
- **Windows 11 x64**: WebView2 동봉 (Win11 기본 포함)
