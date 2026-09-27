/** Settings tabs 04-07: 색깔, 압축파일, 프로그램, 기타 (WinM reference screenshots). */
import React from "react";
import type { ExtAssoc } from "../../lib/config";
import { WinCheck, WinRadio, WinInput, WinButton, WinGroup } from "./controls";
import type { TabEnv } from "./tabsA";

/* ---------------- tab 04: 색깔 ---------------- */

const COLOR_ITEMS: { label: string; v: string }[] = [
  { label: "파일창 배경", v: "--bg" },
  { label: "보통 파일", v: "--fg" },
  { label: "폴더", v: "--dir-fg" },
  { label: "드라이브", v: "--accent" },
  { label: "선택항목 강조색", v: "--cursor-bg" },
  { label: "컬럼 구분선", v: "--border" },
  { label: "항목 구분선", v: "--rowsep" },
  { label: "주석", v: "--info" },
  { label: "숨김 파일", v: "--hidden-fg" },
  { label: "읽기전용 파일", v: "--ro-fg" },
  { label: "1MB이상 크기", v: "--bigsize-fg" },
  { label: "폴더트리 배경", v: "--mcd-bg" },
  { label: "폴더트리 글자", v: "--mcd-fg" },
];

function toHex(v: string): string {
  const m = v.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (m) return `#${m[1].toLowerCase()}`;
  const rgb = v.trim().match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
  if (rgb) {
    const n = (i: number) => Math.max(0, Math.min(255, Number(rgb[i]))).toString(16).padStart(2, "0");
    return `#${n(1)}${n(2)}${n(3)}`;
  }
  return "#000000";
}

function Swatch({ hex, onPick, title }: { hex: string; onPick: (hex: string) => void; title?: string }) {
  return (
    <span className="set-sw" style={{ background: toHex(hex), position: "relative", overflow: "hidden" }} title={title}>
      <input
        type="color"
        value={toHex(hex)}
        onChange={(e) => onPick(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title={title}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          opacity: 0, cursor: "pointer", padding: 0, border: "none",
        }}
      />
    </span>
  );
}

function ExtEditDialog({
  initial,
  taken,
  onOk,
  onCancel,
}: {
  initial: { exts: string; color: string } | null;
  taken: string[];
  onOk: (exts: string, color: string) => void;
  onCancel: () => void;
}) {
  const [exts, setExts] = React.useState(initial?.exts ?? "");
  const [color, setColor] = React.useState(toHex(initial?.color ?? "#ffff00"));
  return (
    <div className="set-subwindow" style={{ width: 380 }}>
      <div className="set-titlebar"><span>{initial ? "수정(M)" : "추가(A)"}</span></div>
      <div className="set-subbody">
        <div className="set-row">
          <span style={{ width: 70 }}>확장자</span>
          <WinInput value={exts} onChange={setExts} style={{ flex: 1 }} title="; 로 구분 (예: zip;rar)" />
        </div>
        <div className="set-note" style={{ color: "#555", fontSize: 11 }}>; 로 구분합니다. (예: zip;rar;7z)</div>
        <div className="set-row" style={{ marginTop: 6 }}>
          <span style={{ width: 70 }}>색깔</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 44, height: 24, padding: 0, border: "1px solid #7f7f7f", background: "#fff" }} />
          <WinInput value={color} onChange={(v) => { if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v); }} style={{ width: 80 }} />
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton
            onClick={() => {
              const list = exts.split(";").map((s) => s.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
              if (list.length === 0) return;
              onOk(list.filter((e) => !taken.includes(e) || (initial?.exts.split(";").includes(e))).join(";"), color);
            }}
          >확인</WinButton>
          <WinButton onClick={onCancel}>취소</WinButton>
        </div>
      </div>
    </div>
  );
}

function MiniFolder() {
  return (
    <span
      style={{
        display: "inline-block", width: 12, height: 9, marginRight: 4, flex: "none",
        background: "#ffcf40", border: "1px solid #a08000", borderRadius: 1,
      }}
    />
  );
}

function TreePreview({ items }: { items: Record<string, string> }) {
  const bg = toHex(items["--mcd-bg"] ?? "#141414");
  const fg = toHex(items["--mcd-fg"] ?? "#d8d8d8");
  const rows: { depth: number; name: string }[] = [
    { depth: 0, name: "C" },
    { depth: 1, name: "현재 폴더" },
    { depth: 1, name: "보통폴더" },
    { depth: 2, name: "복사" },
    { depth: 1, name: "MCD" },
    { depth: 2, name: "WinM" },
    { depth: 2, name: "Note" },
    { depth: 2, name: "Game" },
  ];
  return (
    <div className="set-preview" style={{ background: bg, color: fg, height: 150, padding: 6 }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", paddingLeft: r.depth * 14 }}>
          <MiniFolder />
          <span>{r.name}</span>
        </div>
      ))}
    </div>
  );
}

function FilePreview({ items }: { items: Record<string, string> }) {
  const bg = toHex(items["--bg"] ?? "#000000");
  const fg = toHex(items["--fg"] ?? "#d8d8d8");
  const dir = toHex(items["--dir-fg"] ?? "#ff0000");
  const ro = toHex(items["--ro-fg"] ?? "#999999");
  const hid = toHex(items["--hidden-fg"] ?? "#777777");
  const info = toHex(items["--info"] ?? "#8cdcfe");
  const big = toHex(items["--bigsize-fg"] ?? "#ffff00");
  const cell = { padding: "1px 6px", whiteSpace: "nowrap" as const };
  return (
    <div className="set-preview" style={{ background: bg, color: fg, height: 150, padding: 6 }}>
      <div style={{ display: "flex", color: dir }}>
        <span style={cell}>[폴더]</span><span style={cell}>파일 폴더</span>
      </div>
      <div style={{ display: "flex" }}>
        <span style={cell}>보통파일</span><span style={cell}>EXT</span>
        <span style={{ ...cell, marginLeft: "auto" }}>45,000</span>
      </div>
      <div style={{ display: "flex", color: ro }}>
        <span style={cell}>읽기전용</span><span style={cell}>TST</span>
        <span style={{ ...cell, marginLeft: "auto" }}>54,321</span>
        <span style={cell}>읽기전용</span>
      </div>
      <div style={{ display: "flex", color: hid }}>
        <span style={cell}>숨김파일</span><span style={cell}>HID</span>
        <span style={{ ...cell, marginLeft: "auto" }}>146,000</span>
        <span style={cell}>숨김파일</span>
      </div>
      <div style={{ display: "flex", color: info }}>
        <span style={cell}>[-A-]</span><span style={cell}>주석</span>
      </div>
      <div style={{ display: "flex" }}>
        <span style={cell}>[-C-]</span>
        <span style={{ ...cell, marginLeft: "auto", color: big }}>12.3GB</span>
      </div>
    </div>
  );
}

export function TabColor({ w, setW, extColors, setExtColors, openSub, closeSub, importCol, exportCol }: TabEnv) {
  const c = w.color;
  const u = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) =>
    setW((p) => ({ ...p, color: { ...p.color, [k]: v } }));
  const setItem = (v: string, hex: string) =>
    setW((p) => ({ ...p, color: { ...p.color, items: { ...p.color.items, [v]: hex } } }));
  const [selItem, setSelItem] = React.useState(0);
  const [selExt, setSelExt] = React.useState<string | null>(null);

  // ext -> hex list, grouped display
  const rows = React.useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const [ext, hex] of Object.entries(extColors)) {
      const h = toHex(hex);
      if (!groups.has(h)) groups.set(h, []);
      groups.get(h)!.push(ext);
    }
    return [...groups.entries()].map(([hex, exts]) => ({ hex, exts: exts.sort(), key: exts.sort().join(";") }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [extColors]);

  const openExtEdit = (initial: { exts: string; color: string } | null) => {
    openSub(
      <ExtEditDialog
        initial={initial}
        taken={Object.keys(extColors)}
        onOk={(exts, color) => {
          const next = { ...extColors };
          if (initial) {
            for (const e of initial.exts.split(";")) delete next[e];
          }
          for (const e of exts.split(";")) next[e] = color;
          setExtColors(next);
          closeSub();
        }}
        onCancel={closeSub}
      />,
    );
  };

  return (
    <div>
      <div className="set-cols">
        <div>
          <WinCheck checked={c.enabled} onChange={(v) => u("enabled", v)}>색깔 사용</WinCheck>
          <div className="set-list" style={{ height: 208, marginTop: 4 }}>
            {COLOR_ITEMS.map((it, i) => (
              <div key={it.v} className={`lrow${selItem === i ? " sel" : ""}`}
                onClick={() => setSelItem(i)}>
                <Swatch hex={c.items[it.v] ?? "#000000"} onPick={(hex) => setItem(it.v, hex)} title="클릭하여 색 변경" />
                <span>{it.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <WinCheck checked={c.extEnabled} onChange={(v) => u("extEnabled", v)}>확장자 색 사용</WinCheck>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <div className="set-list" style={{ height: 208, flex: 1 }}>
              {rows.map((r) => (
                <div key={r.key} className={`lrow${selExt === r.key ? " sel" : ""}`}
                  onClick={() => setSelExt(r.key)} onDoubleClick={() => openExtEdit({ exts: r.key, color: r.hex })}>
                  <Swatch hex={r.hex} onPick={() => openExtEdit({ exts: r.key, color: r.hex })} title="클릭하여 수정" />
                  <span>{r.exts.join(";")}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <WinButton onClick={() => openExtEdit(null)}>추가(A)...</WinButton>
              <WinButton onClick={() => {
                const r = rows.find((x) => x.key === selExt);
                if (r) openExtEdit({ exts: r.key, color: r.hex });
              }} disabled={!selExt}>수정(M)...</WinButton>
              <WinButton onClick={() => {
                if (!selExt) return;
                const next = { ...extColors };
                for (const e of selExt.split(";")) delete next[e];
                setExtColors(next);
                setSelExt(null);
              }} disabled={!selExt}>삭제(R)</WinButton>
            </div>
          </div>
        </div>
      </div>
      <div className="set-cols" style={{ marginTop: 8 }}>
        <TreePreview items={c.items} />
        <FilePreview items={c.items} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-start" }}>
          <WinButton onClick={importCol}>불러오기...</WinButton>
          <WinButton onClick={exportCol}>색깔 저장...</WinButton>
        </div>
      </div>
    </div>
  );
}

/* ---------------- tab 05: 압축파일 ---------------- */

export function TabArchive({ w, setW, pickPath }: TabEnv) {
  const a = w.arc;
  const u = <K extends keyof typeof a>(k: K, v: (typeof a)[K]) =>
    setW((p) => ({ ...p, arc: { ...p.arc, [k]: v } }));
  const setProg = (i: number, patch: Partial<(typeof a.programs)[number]>) =>
    setW((p) => {
      const programs = p.arc.programs.map((pr, j) => (j === i ? { ...pr, ...patch } : pr));
      return { ...p, arc: { ...p.arc, programs } };
    });
  return (
    <div>
      <WinGroup label="압축파일 옵션">
        <div className="set-cols">
          <div>
            <WinCheck checked={a.folderLike} onChange={(v) => u("folderLike", v)}>압축파일을 폴더처럼 보기</WinCheck>
            <WinCheck checked={a.noSfx} onChange={(v) => u("noSfx", v)}>SFX 압축파일 보기 안함</WinCheck>
            <WinCheck checked={a.escExit} onChange={(v) => u("escExit", v)}>Esc 키로 압축파일 보기 빠져 나옴</WinCheck>
            <WinCheck checked={a.ctrlXExtract} onChange={(v) => u("ctrlXExtract", v)}>Ctrl+X 키로 압축풀기</WinCheck>
          </div>
          <div>
            <WinCheck checked={a.extractToNamedDir} onChange={(v) => u("extractToNamedDir", v)}>
              단일창에서 파일이름의 폴더에 풀기
            </WinCheck>
            <WinCheck checked={a.chdirAfterExtract} onChange={(v) => u("chdirAfterExtract", v)}>
              단일창에서 풀기후 경로 변경
            </WinCheck>
            <WinCheck checked={a.noExtractDlg} onChange={(v) => u("noExtractDlg", v)}>압축 풀기 대화상자 표시 안함</WinCheck>
          </div>
        </div>
      </WinGroup>
      <WinGroup label="압축/해제 프로그램">
        {a.programs.map((pr, i) => (
          <div className="set-row" key={pr.label}>
            <span style={{ width: 64 }}>{pr.label}</span>
            <WinInput value={pr.path} onChange={(v) => setProg(i, { path: v })} style={{ flex: 1 }} />
            <WinButton onClick={() => pickPath(pr.path, (p) => setProg(i, { path: p }))}>{" >> "}</WinButton>
            {pr.showDirect && (
              <WinCheck checked={pr.direct} onChange={(v) => setProg(i, { direct: v })}>가능하면 직접 처리</WinCheck>
            )}
          </div>
        ))}
      </WinGroup>
    </div>
  );
}

/* ---------------- tab 06: 프로그램 ---------------- */

const FN_KEYS: { key: string; action: string }[] = [
  { key: "F1", action: "도움말" },
  { key: "F2", action: "새로고침" },
  { key: "F3", action: "드라이브" },
  { key: "F4", action: "이동" },
  { key: "F5", action: "복사" },
  { key: "F6", action: "이름바꾸기" },
  { key: "F7", action: "폴더만들기" },
  { key: "F8", action: "삭제" },
  { key: "F9", action: "등록정보" },
  { key: "F10", action: "지정 안함" },
  { key: "F11", action: "지정 안함" },
  { key: "F12", action: "지정 안함 (Ctrl+F12: 환경설정)" },
];

function FnKeyDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="set-subwindow" style={{ width: 360 }}>
      <div className="set-titlebar"><span>평션키 기능 설정</span></div>
      <div className="set-subbody">
        <div className="set-list" style={{ height: 260 }}>
          {FN_KEYS.map((f) => (
            <div key={f.key} className="lrow">
              <span style={{ width: 40, fontWeight: 700 }}>{f.key}</span>
              <span>{f.action}</span>
            </div>
          ))}
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton onClick={onClose}>닫기</WinButton>
        </div>
      </div>
    </div>
  );
}

function AssocDialog({
  assoc, onOk, onCancel,
}: {
  assoc: ExtAssoc[];
  onOk: (a: ExtAssoc[]) => void;
  onCancel: () => void;
}) {
  const [list, setList] = React.useState<ExtAssoc[]>(assoc.map((a) => ({ ...a })));
  const [sel, setSel] = React.useState<number | null>(null);
  const [ext, setExt] = React.useState("");
  const [prog, setProg] = React.useState("");
  const add = () => {
    const e = ext.trim().replace(/^\./, "").toLowerCase();
    if (!e) return;
    if (!list.some((x) => x.ext === `.${e}`)) setList([...list, { ext: `.${e}`, program: prog.trim() }]);
    setExt(""); setProg("");
  };
  return (
    <div className="set-subwindow" style={{ width: 460 }}>
      <div className="set-titlebar"><span>확장자 실행 설정</span></div>
      <div className="set-subbody">
        <div className="set-list" style={{ height: 200 }}>
          {list.map((a, i) => (
            <div key={a.ext} className={`lrow${sel === i ? " sel" : ""}`} onClick={() => setSel(i)}>
              <span style={{ width: 70 }}>{a.ext}</span>
              <span>{a.program || "(시스템 기본값)"}</span>
            </div>
          ))}
        </div>
        <div className="set-row" style={{ marginTop: 6 }}>
          <WinInput value={ext} onChange={setExt} style={{ width: 80 }} title="확장자" />
          <WinInput value={prog} onChange={setProg} style={{ flex: 1 }} title="프로그램 경로 (비우면 시스템 기본값)" />
          <WinButton onClick={add}>추가</WinButton>
          <WinButton disabled={sel == null} onClick={() => {
            if (sel == null) return;
            setList(list.filter((_, i) => i !== sel));
            setSel(null);
          }}>삭제</WinButton>
        </div>
        <div className="set-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
          <WinButton onClick={() => onOk(list)}>확인</WinButton>
          <WinButton onClick={onCancel}>취소</WinButton>
        </div>
      </div>
    </div>
  );
}

export function TabProgram({ w, setW, assoc, setAssoc, pickPath, openSub, closeSub }: TabEnv) {
  const p = w.prog;
  const u = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) =>
    setW((prev) => ({ ...prev, prog: { ...prev.prog, [k]: v } }));
  return (
    <div>
      <WinGroup label="펑션키/확장자">
        <div className="set-row">
          <WinButton wide onClick={() => openSub(<FnKeyDialog onClose={closeSub} />)}>
            평션키 기능 설정(F)
          </WinButton>
          <WinButton wide onClick={() => openSub(
            <AssocDialog assoc={assoc} onOk={(a) => { setAssoc(a); closeSub(); }} onCancel={closeSub} />,
          )}>
            확장자 실행 설정(E)
          </WinButton>
        </div>
        <WinCheck checked={p.quotePaths} onChange={(v) => u("quotePaths", v)}>
          변수가 공백이 포함된 경로명을 리턴하는 경우 자동으로 따옴표 붙임
        </WinCheck>
      </WinGroup>
      <WinGroup label="외부 프로그램">
        <div className="set-row">
          <span style={{ width: 96 }}>보기 프로그램(V)</span>
          <WinInput value={p.viewer} onChange={(v) => u("viewer", v)} style={{ flex: 1 }} />
          <WinButton onClick={() => pickPath(p.viewer, (v) => u("viewer", v))}>{" >> "}</WinButton>
          <WinCheck checked={p.viewerInMenu} onChange={(v) => u("viewerInMenu", v)}>자체메뉴에 표시</WinCheck>
        </div>
        <div className="set-row">
          <span style={{ width: 96 }}>편집 프로그램(G)</span>
          <WinInput value={p.editor} onChange={(v) => u("editor", v)} style={{ flex: 1 }} />
          <WinButton onClick={() => pickPath(p.editor, (v) => u("editor", v))}>{" >> "}</WinButton>
          <WinCheck checked={p.editorInMenu} onChange={(v) => u("editorInMenu", v)}>자체메뉴에 표시</WinCheck>
        </div>
      </WinGroup>
    </div>
  );
}

/* ---------------- tab 07: 기타 ---------------- */

export function TabEtc({
  w, setW, pickPath, importConfig, exportConfig, clearPrevPaths,
}: TabEnv) {
  const e = w.etc;
  const u = <K extends keyof typeof e>(k: K, v: (typeof e)[K]) =>
    setW((p) => ({ ...p, etc: { ...p.etc, [k]: v } }));
  return (
    <div>
      <WinGroup label="환경설정 파일">
        <div className="set-row">
          <WinButton wide onClick={importConfig}>불러오기(O)...</WinButton>
          <WinButton wide onClick={exportConfig}>다른 이름으로 저장(S)...</WinButton>
        </div>
        <WinCheck checked={e.autoSave} onChange={(v) => u("autoSave", v)}>환경 자동 저장</WinCheck>
      </WinGroup>
      <WinGroup label="기타">
        <WinCheck checked={e.keepSplit} onChange={(v) => u("keepSplit", v)}>창분할 상태 보관</WinCheck>
        <WinCheck checked={e.syncHeaderGap} onChange={(v) => u("syncHeaderGap", v)}>
          다른 창의 헤더컨트롤 간격도 함께 조정함
        </WinCheck>
        <WinCheck checked={e.syncTreeSize} onChange={(v) => u("syncTreeSize", v)}>
          다른 창의 폴더트리 크기도 함께 조정함
        </WinCheck>
        <WinCheck checked={e.syncMcdPos} onChange={(v) => u("syncMcdPos", v)}>
          MCD 창크기와위치를 파일창과 같게 조정함
        </WinCheck>
      </WinGroup>
      <WinGroup label="시작/경로">
        <div className="set-row">
          <WinRadio checked={e.startMode === "last"} onChange={() => u("startMode", "last")}>
            마지막으로 사용했던 폴더에서 시작
          </WinRadio>
          <span style={{ flex: 1 }} />
          <WinCheck checked={e.noNetStart} onChange={(v) => u("noNetStart", v)}>
            네트워크 경로에서 시작하지 않음
          </WinCheck>
        </div>
        <div className="set-row">
          <WinRadio checked={e.startMode === "path"} onChange={() => u("startMode", "path")}>
            시작 경로 지정
          </WinRadio>
          <WinInput value={e.startPath} onChange={(v) => u("startPath", v)} style={{ flex: 1 }} />
          <WinButton onClick={() => pickPath(e.startPath, (v) => u("startPath", v))}>{" >> "}</WinButton>
        </div>
        <div className="set-row">
          <WinCheck checked={e.clearPrevOnExit} onChange={(v) => u("clearPrevOnExit", v)}>
            종료시 이전 경로 지움
          </WinCheck>
          <span style={{ flex: 1 }} />
          <WinButton onClick={clearPrevPaths}>이전 경로 지금 삭제</WinButton>
        </div>
      </WinGroup>
    </div>
  );
}
