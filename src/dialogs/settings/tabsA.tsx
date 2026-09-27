/** Settings tabs 01-03: 파일창, 표시, 처리 (WinM reference screenshots). */
import React from "react";
import type { WinmSettings, WinmPanelSettings, ExtAssoc } from "../../lib/config";
import { WinCheck, WinSelect, WinInput, WinButton, WinGroup } from "./controls";

export interface TabEnv {
  w: WinmSettings;
  setW: (fn: (w: WinmSettings) => WinmSettings) => void;
  assoc: ExtAssoc[];
  setAssoc: (a: ExtAssoc[]) => void;
  extColors: Record<string, string>;
  setExtColors: (c: Record<string, string>) => void;
  pickPath: (initial: string, cb: (p: string) => void) => void;
  openSub: (node: React.ReactNode) => void;
  closeSub: () => void;
  importCol: () => void;
  exportCol: () => void;
  importConfig: () => void;
  exportConfig: () => void;
  clearPrevPaths: () => void;
}

/* ---------------- tab 01: 파일창 ---------------- */

function PanelBlock({
  title,
  p,
  onChange,
}: {
  title: string;
  p: WinmPanelSettings;
  onChange: (p: WinmPanelSettings) => void;
}) {
  const u = <K extends keyof WinmPanelSettings>(k: K, v: WinmPanelSettings[K]) =>
    onChange({ ...p, [k]: v });
  return (
    <WinGroup label={title}>
      <div className="set-row">
        <WinCheck checked={p.showPathBar} onChange={(v) => u("showPathBar", v)}>경로표시줄</WinCheck>
        <WinCheck checked={p.showHeader} onChange={(v) => u("showHeader", v)}>헤더</WinCheck>
        <WinCheck checked={p.showStatusBar} onChange={(v) => u("showStatusBar", v)}>상태표시줄</WinCheck>
      </div>
      <WinGroup label="컬럼">
        <div className="set-row">
          <WinSelect value={p.columnMode} onChange={(v) => u("columnMode", v)}
            options={["모드1", "모드2", "자동선택"]} style={{ width: 130 }} />
          <WinSelect value={p.columnUsage} onChange={(v) => u("columnUsage", v)}
            options={["모두 사용", "이름/크기/날짜", "이름만"]} style={{ width: 130 }} />
        </div>
      </WinGroup>
      <WinGroup label="정렬">
        <div className="set-row">
          <WinSelect value={p.sortBy} onChange={(v) => u("sortBy", v)}
            options={["이름", "확장자", "크기", "날짜"]} style={{ width: 130 }} />
          <WinCheck checked={p.sortAsc} onChange={(v) => u("sortAsc", v)}>오름차순</WinCheck>
        </div>
      </WinGroup>
      <div className="set-row">
        <WinCheck checked={p.columnSeparators} onChange={(v) => u("columnSeparators", v)}>컬럼구분선</WinCheck>
        <WinCheck checked={p.showHidden} onChange={(v) => u("showHidden", v)}>숨김 파일 표시</WinCheck>
      </div>
      <div className="set-row">
        <WinCheck checked={p.rowSeparators} onChange={(v) => u("rowSeparators", v)}>항목구분선</WinCheck>
        <WinCheck checked={p.propViewMode1} onChange={(v) => u("propViewMode1", v)}>속성보기(모드1)</WinCheck>
      </div>
    </WinGroup>
  );
}

export function TabFileWin({ w, setW }: TabEnv) {
  const u = <K extends keyof WinmSettings>(k: K, v: WinmSettings[K]) =>
    setW((p) => ({ ...p, [k]: v }));
  return (
    <div>
      <div className="set-cols">
        <PanelBlock title="첫째 파일창" p={w.panel1} onChange={(p) => u("panel1", p)} />
        <PanelBlock title="둘째 파일창" p={w.panel2} onChange={(p) => u("panel2", p)} />
      </div>
      <div className="set-row" style={{ marginTop: 4 }}>
        <WinCheck checked={w.pageScroll} onChange={(v) => u("pageScroll", v)}>
          페이지 단위 스크롤
        </WinCheck>
      </div>
      <div className="set-row">
        <WinCheck checked={w.autoColMode2Limit} onChange={(v) => u("autoColMode2Limit", v)}>
          컬럼이 자동선택될 때 주석이 있는 폴더는 모드2 이하로 제한
        </WinCheck>
      </div>
      <div className="set-row">
        <WinCheck checked={w.autoColWidth} onChange={(v) => u("autoColWidth", v)}>
          컬럼폭 자동 조정
        </WinCheck>
      </div>
      <div className="set-row">
        <WinCheck checked={w.folderSortMethod} onChange={(v) => u("folderSortMethod", v)}>
          폴더 정렬방법 지정
        </WinCheck>
        <WinSelect value={w.folderSortBy} onChange={(v) => u("folderSortBy", v)}
          options={["이름", "확장자", "크기", "날짜"]} style={{ width: 150 }} />
      </div>
      <div className="set-row" style={{ marginTop: 4 }}>
        <WinSelect value={w.defaultsPreset} onChange={(v) => u("defaultsPreset", v)}
          options={["기본값"]} style={{ width: "100%" }} />
      </div>
    </div>
  );
}

/* ---------------- tab 02: 표시 ---------------- */

const FONT_FAMILIES = ["맑은 고딕", "굴림", "돋움", "바탕", "system-ui", "sans-serif", "monospace"];

export function FontSubDialog({
  title,
  initial,
  onOk,
  onCancel,
}: {
  title: string;
  initial: { name: string; size: number };
  onOk: (f: { name: string; size: number }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState(initial.name);
  const [size, setSize] = React.useState(String(initial.size));
  return (
    <div className="set-subwindow" style={{ width: 360 }}>
      <div className="set-titlebar">
        <span>{title}</span>
      </div>
      <div className="set-subbody">
        <div className="set-row">
          <span style={{ width: 60 }}>글꼴</span>
          <WinSelect value={name} onChange={setName} options={FONT_FAMILIES} style={{ width: 200 }} />
        </div>
        <div className="set-row">
          <span style={{ width: 60 }}>크기</span>
          <WinSelect value={size} onChange={setSize}
            options={["9", "10", "11", "12", "13", "14"]} style={{ width: 100 }} />
        </div>
        <div className="set-note" style={{ marginTop: 8, border: "1px solid #7f7f7f", background: "#fff", padding: 8, fontFamily: name, fontSize: Number(size) || 12 }}>
          가나다라 ABC abc 123
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton onClick={() => onOk({ name, size: Number(size) || 12 })}>확인</WinButton>
          <WinButton onClick={onCancel}>취소</WinButton>
        </div>
      </div>
    </div>
  );
}

export function TabDisplay({ w, setW, openSub, closeSub }: TabEnv) {
  const d = w.disp;
  const u = <K extends keyof WinmSettings["disp"]>(k: K, v: WinmSettings["disp"][K]) =>
    setW((p) => ({ ...p, disp: { ...p.disp, [k]: v } }));
  const openFont = (kind: "filewin" | "mcd") => {
    const cur = kind === "filewin" ? d.filewinFont : d.mcdFont;
    openSub(
      <FontSubDialog
        title={kind === "filewin" ? "파일창 글꼴" : "MCD 글꼴"}
        initial={cur}
        onOk={(f) => {
          u(kind === "filewin" ? "filewinFont" : "mcdFont", f);
          closeSub();
        }}
        onCancel={closeSub}
      />,
    );
  };
  return (
    <div>
      <WinGroup label="표시">
        <div className="set-cols">
          <div>
            <WinCheck checked={d.analyzeIcons} onChange={(v) => u("analyzeIcons", v)}>
              파일 아이콘/종류 분석(느려짐)
            </WinCheck>
            <div className="set-row" style={{ paddingLeft: 18 }}>
              <WinCheck checked={d.showIcons} onChange={(v) => u("showIcons", v)} disabled>아이콘 표시</WinCheck>
              <WinCheck checked={d.extractIcons} onChange={(v) => u("extractIcons", v)} disabled>아이콘 추출</WinCheck>
            </div>
            <div style={{ paddingLeft: 18 }}>
              <WinCheck checked={d.noExtractRemote} onChange={(v) => u("noExtractRemote", v)} disabled>
                플로피/네트워크에선 아이콘 추출 안함
              </WinCheck>
              <WinCheck checked={d.showTypeNoDesc} onChange={(v) => u("showTypeNoDesc", v)} disabled>
                주석이 없는 항목은 종류 표시
              </WinCheck>
            </div>
            <WinCheck checked={d.showMcdIcon} onChange={(v) => u("showMcdIcon", v)}>
              폴더관리기(MCD) 아이콘 표시
            </WinCheck>
            <WinCheck checked={d.showTreeIcon} onChange={(v) => u("showTreeIcon", v)}>
              폴더트리 아이콘 표시
            </WinCheck>
            <WinCheck checked={d.showSelMark} onChange={(v) => u("showSelMark", v)}>
              선택마크 표시
            </WinCheck>
            <WinCheck checked={d.emphasizeSelColor} onChange={(v) => u("emphasizeSelColor", v)}>
              선택한 항목을 색깔로 강조 표시
            </WinCheck>
            <WinCheck checked={d.selBarOutline} onChange={(v) => u("selBarOutline", v)}>
              선택 막대를 테두리 선으로 표시
            </WinCheck>
            <WinCheck checked={d.folderTag} onChange={(v) => u("folderTag", v)}>
              폴더 항목에 [폴더]표시
            </WinCheck>
            <WinCheck checked={d.folderInFolderColor} onChange={(v) => u("folderInFolderColor", v)}>
              폴더 항목을 폴더색으로 표시
            </WinCheck>
            <WinCheck checked={d.ellipsisNoSpace} onChange={(v) => u("ellipsisNoSpace", v)}>
              파일창 공간부족하면 "…" 표시
            </WinCheck>
            <WinCheck checked={d.vertScrollbarOnly} onChange={(v) => u("vertScrollbarOnly", v)}>
              파일창 수직스크롤바만 사용함
            </WinCheck>
            <div className="set-row">
              <span>폴더 대/소문자 표시</span>
              <WinSelect value={d.folderCase} onChange={(v) => u("folderCase", v)}
                options={["변경 안함", "대문자", "소문자"]} style={{ width: 120 }} />
            </div>
            <div className="set-row">
              <span>파일 대/소문자 표시</span>
              <WinSelect value={d.fileCase} onChange={(v) => u("fileCase", v)}
                options={["변경 안함", "대문자", "소문자"]} style={{ width: 120 }} />
            </div>
          </div>
          <div>
            <div className="set-row">
              <WinCheck checked={d.driveDisplay} onChange={(v) => u("driveDisplay", v)}>드라이브 표시</WinCheck>
              <WinSelect value={d.driveDisplayTarget} onChange={(v) => u("driveDisplayTarget", v)}
                options={["모든 파일창", "첫째 파일창", "둘째 파일창"]} style={{ width: 130 }} />
            </div>
            <div className="set-row">
              <WinCheck checked={d.driveCapacity} onChange={(v) => u("driveCapacity", v)}>드라이브 용량 표시</WinCheck>
              <WinSelect value={d.driveCapacityTarget} onChange={(v) => u("driveCapacityTarget", v)}
                options={["드라이브 항목", "상태줄"]} style={{ width: 130 }} />
            </div>
            <div className="set-row">
              <WinCheck checked={d.tooltip} onChange={(v) => u("tooltip", v)}>항목 툴팁</WinCheck>
              <span>표시시간(1초=100)</span>
              <WinInput value={String(d.tooltipTime)} onChange={(v) => u("tooltipTime", Number(v) || 0)}
                style={{ width: 60 }} />
            </div>
            <div className="set-row">
              <WinCheck checked={d.hour24} onChange={(v) => u("hour24", v)}>24시간제 표시</WinCheck>
              <WinCheck checked={d.year4} onChange={(v) => u("year4", v)}>4자리 년도 표시</WinCheck>
            </div>
            <div className="set-row">
              <span>파일목록 크기 표시</span>
              <WinSelect value={d.sizeUnit} onChange={(v) => u("sizeUnit", v)}
                options={["바이트단위", "자동단위"]} style={{ width: 130 }} />
            </div>
            <WinCheck checked={d.statusKbMb} onChange={(v) => u("statusKbMb", v)}>상태줄 KB/MB</WinCheck>
            <WinCheck checked={d.extAttached} onChange={(v) => u("extAttached", v)}>확장자 붙여서 표시</WinCheck>
            <WinCheck checked={d.alwaysShowHiddenDir} onChange={(v) => u("alwaysShowHiddenDir", v)}>
              파일창 숨김 폴더 항상 표시
            </WinCheck>
            <div className="set-row">
              <WinCheck checked={d.menuWrap} onChange={(v) => u("menuWrap", v)}>메뉴 랩</WinCheck>
              <WinCheck checked={d.toolbarWrap} onChange={(v) => u("toolbarWrap", v)}>툴바 랩</WinCheck>
            </div>
            <WinCheck checked={d.flatKeybar} onChange={(v) => u("flatKeybar", v)}>Flat 단축키 표시줄</WinCheck>
            <WinCheck checked={d.treeColorAdjust} onChange={(v) => u("treeColorAdjust", v)}>폴더트리 색깔 조정</WinCheck>
            <WinCheck checked={d.treeAutoFold} onChange={(v) => u("treeAutoFold", v)}>폴더 트리 자동 접기/펴기</WinCheck>
            <div className="set-row" style={{ marginTop: 6 }}>
              <WinButton wide onClick={() => openFont("filewin")}>파일창 글꼴</WinButton>
              <WinButton wide onClick={() => openFont("mcd")}>MCD 글꼴</WinButton>
            </div>
          </div>
        </div>
      </WinGroup>
    </div>
  );
}

/* ---------------- tab 03: 처리 ---------------- */

export function TabProcess({ w, setW }: TabEnv) {
  const p = w.proc;
  const u = <K extends keyof WinmSettings["proc"]>(k: K, v: WinmSettings["proc"][K]) =>
    setW((prev) => ({ ...prev, proc: { ...prev.proc, [k]: v } }));
  return (
    <div>
      <WinGroup label="기능">
        <div className="set-cols">
          <div>
            <WinCheck checked={p.keepSplitRatio} onChange={(v) => u("keepSplitRatio", v)}>창 분할 비율 유지</WinCheck>
            <WinCheck checked={p.showSizeOnSelectDir} onChange={(v) => u("showSizeOnSelectDir", v)}>폴더 선택시 용량표시</WinCheck>
            <WinCheck checked={p.clearSizeOnDeselectDir} onChange={(v) => u("clearSizeOnDeselectDir", v)}>
              폴더 선택 해제시 용량 표시 지움
            </WinCheck>
            <WinCheck checked={p.watchDirChanges} onChange={(v) => u("watchDirChanges", v)}>파일창 목록 변경 감시</WinCheck>
            <WinCheck checked={p.autoRefreshTree} onChange={(v) => u("autoRefreshTree", v)}>
              파일창에서 트리구조 자동 갱신
            </WinCheck>
            <WinCheck checked={p.treeFileAtRoot} onChange={(v) => u("treeFileAtRoot", v)}>트리파일을 루트에 만들기</WinCheck>
            <WinCheck checked={p.quickFindExt} onChange={(v) => u("quickFindExt", v)}>빨리 찾기 기능 확장</WinCheck>
            <WinCheck checked={p.backspaceUp} onChange={(v) => u("backspaceUp", v)}>백 스페이스 키로 위로 가기</WinCheck>
            <WinCheck checked={p.ctrlPgUpDnMdir3} onChange={(v) => u("ctrlPgUpDnMdir3", v)}>
              파일창 Ctrl+PgUp/PgDn을 MdirIII처럼
            </WinCheck>
            <WinCheck checked={p.shiftDriveIME} onChange={(v) => u("shiftDriveIME", v)}>
              한글 입력 상태에서 Shift+드라이브 가능
            </WinCheck>
            <WinCheck checked={p.driveSelectToMcd} onChange={(v) => u("driveSelectToMcd", v)}>
              드라이브 선택후 폴더관리기로 대상 선택
            </WinCheck>
            <WinGroup label="창 분할시 작업대상 경로">
              <WinSelect value={p.splitTargetPath} onChange={(v) => u("splitTargetPath", v)}
                options={["다른창으로 작업할지 묻기", "다른 창으로", "같은 창으로"]} style={{ width: "100%" }} />
            </WinGroup>
          </div>
          <div>
            <WinCheck checked={p.noTrash} onChange={(v) => u("noTrash", v)}>휴지통 사용 안함</WinCheck>
            <WinCheck checked={p.deleteDefaultYes} onChange={(v) => u("deleteDefaultYes", v)}>영구삭제 초기값 "예"</WinCheck>
            <WinCheck checked={p.descAsHidden} onChange={(v) => u("descAsHidden", v)}>주석을 숨김 파일로</WinCheck>
            <div className="set-row">
              <WinCheck checked={p.read83Desc} onChange={(v) => u("read83Desc", v)}>8.3이름 주석 읽기</WinCheck>
              <WinCheck checked={p.write83Desc} onChange={(v) => u("write83Desc", v)}>쓰기</WinCheck>
            </div>
            <WinCheck checked={p.dragDelay03} onChange={(v) => u("dragDelay03", v)}>0.3초후 드래그 시작(실수방지)</WinCheck>
            <WinCheck checked={p.leftDropMenu} onChange={(v) => u("leftDropMenu", v)}>
              왼쪽 버튼으로 드롭할 때 메뉴표시
            </WinCheck>
            <WinCheck checked={p.cdRemoveRO} onChange={(v) => u("cdRemoveRO", v)}>
              CD에서 복사시 읽기 전용 속성 제거
            </WinCheck>
            <WinCheck checked={p.askDeleteErrCopy} onChange={(v) => u("askDeleteErrCopy", v)}>
              복사중 오류 발생한 파일 삭제할지 묻기
            </WinCheck>
            <WinCheck checked={p.showCopySpeed} onChange={(v) => u("showCopySpeed", v)}>복사속도 표시</WinCheck>
            <div className="set-row">
              <span style={{ width: 76 }}>Esc키 기능</span>
              <WinSelect value={p.escFunc} onChange={(v) => u("escFunc", v)}
                options={["최소화", "창 닫기", "아무것도 안함"]} style={{ width: 170 }} />
            </div>
            <div className="set-row">
              <span style={{ width: 76 }}>Tab키 기능</span>
              <WinSelect value={p.tabFunc} onChange={(v) => u("tabFunc", v)}
                options={["다른 창으로", "다음 컨트롤"]} style={{ width: 170 }} />
            </div>
            <div className="set-row">
              <span style={{ width: 76 }}>가운데 버튼</span>
              <WinSelect value={p.midBtn} onChange={(v) => u("midBtn", v)}
                options={["지정 안함", "새 창으로", "메뉴 표시"]} style={{ width: 170 }} />
            </div>
            <div className="set-row">
              <span style={{ width: 76 }}>오른쪽 버튼</span>
              <WinSelect value={p.rightBtn} onChange={(v) => u("rightBtn", v)}
                options={["탐색기 메뉴", "WinM 메뉴", "지정 안함"]} style={{ width: 170 }} />
            </div>
          </div>
        </div>
      </WinGroup>
    </div>
  );
}
