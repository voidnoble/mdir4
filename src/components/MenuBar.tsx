import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import type { WinMItem, WinMTop } from "../menus/winm";

interface MenuBarProps {
  menus: WinMTop[];
  onAction: (item: WinMItem) => void;
}

function labelOf(t: (k: string) => string, item: WinMItem): string {
  const base = t(item.label);
  return item.mnemonic ? `${base}(${item.mnemonic})` : base;
}

/** WinM-style menu bar: in-window bar with white dropdowns, nested submenus,
 *  left-aligned names and right-aligned shortcut hints (per winm-menus.png). */
export default function MenuBar({ menus, onAction }: MenuBarProps) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null);
  /** cursor path inside the open menu, e.g. [4] or [12, 2] */
  const [path, setPath] = useState<number[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const menusRef = useRef(menus);
  menusRef.current = menus;
  const stateRef = useRef({ open, path });
  stateRef.current = { open, path };

  const close = () => {
    setOpen(null);
    setPath([]);
  };

  const fire = (item: WinMItem) => {
    if (item.disabled || item.sep || !item.act) return;
    close();
    onAction(item);
  };

  // items at a given depth of the cursor path
  const levelItems = (topIdx: number, p: number[]): WinMItem[] => {
    let items = menusRef.current[topIdx]?.items ?? [];
    for (let d = 0; d < p.length - 1; d++) {
      items = items[p[d]]?.sub ?? [];
    }
    return items;
  };

  const selectable = (items: WinMItem[]) =>
    items
      .map((it, i) => ({ it, i }))
      .filter(({ it }) => !it.sep && !it.disabled);

  const moveCursor = (dir: 1 | -1) => {
    const { open: o, path: p } = stateRef.current;
    if (o === null) return;
    const items = levelItems(o, p.length === 0 ? [0] : p);
    const sel = selectable(items);
    if (sel.length === 0) return;
    const cur = p.length === 0 ? -1 : p[p.length - 1];
    let si = sel.findIndex(({ i }) => i === cur);
    si = si < 0 ? (dir === 1 ? 0 : sel.length - 1) : (si + dir + sel.length) % sel.length;
    const np = [...p.slice(0, -1), sel[si].i];
    setPath(p.length === 0 ? [sel[si].i] : np);
  };

  // capture-phase keyboard: runs before the app's own key handler
  useEffect(() => {
    // 0-depth menu accelerator: Alt+<mnemonic> (e.g. Alt+F opens 파일 and shows
    // its 1-depth items). Match by typed char, with a physical-key fallback
    // because macOS Option+letter yields composed chars (e.g. Ï for ⌥F).
    const topMnemonicIndex = (e: KeyboardEvent): number => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return -1;
      const ms = menusRef.current;
      if (e.key.length === 1) {
        const k = e.key.toLowerCase();
        const i = ms.findIndex((m) => m.mnemonic.toLowerCase() === k);
        if (i >= 0) return i;
      }
      for (let i = 0; i < ms.length; i++) {
        const mn = ms[i].mnemonic.toUpperCase();
        if (/^[A-Z]$/.test(mn) && e.code === `Key${mn}`) return i;
      }
      return -1;
    };

    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) return;
      const { open: o, path: p } = stateRef.current;
      const ms = menusRef.current;
      const single = e.key.length === 1 ? e.key.toLowerCase() : "";

      // Alt+F / Alt+I / ... : open that 0-depth menu (or switch to it while open),
      // displaying its 1-depth items
      const mi = topMnemonicIndex(e);
      if (mi >= 0) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(mi);
        setPath([]);
        return;
      }

      if (o === null) return; // closed: everything else belongs to the app

      // menu open + another Alt+letter (an app action accelerator like Alt+C):
      // close the menu and let it fall through to the app handler
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
        close();
        return;
      }

      // menu is open: swallow navigation keys so the app handler ignores them
      const items = levelItems(o, p.length === 0 ? [0] : p);
      const cur = p.length === 0 ? -1 : p[p.length - 1];
      const curItem = cur >= 0 ? items[cur] : undefined;
      const grab = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      if (e.key === "Escape") {
        grab();
        if (p.length > 1) setPath(p.slice(0, -1));
        else close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        grab();
        moveCursor(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "ArrowRight") {
        grab();
        if (curItem?.sub && !curItem.disabled) {
          const first = selectable(curItem.sub)[0];
          if (first) setPath([...p, first.i]);
        } else {
          const n = (o + 1) % ms.length;
          setOpen(n);
          setPath([]);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        grab();
        if (p.length > 1) setPath(p.slice(0, -1));
        else {
          const n = (o - 1 + ms.length) % ms.length;
          setOpen(n);
          setPath([]);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        grab();
        if (curItem && !curItem.disabled && !curItem.sep) {
          if (curItem.sub) {
            const first = selectable(curItem.sub)[0];
            if (first) setPath([...p, first.i]);
          } else fire(curItem);
        }
        return;
      }
      // mnemonic jump among siblings (single-char mnemonics only)
      if (single && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const hit = selectable(items).find(
          ({ it }) => (it.mnemonic ?? "").toLowerCase() === single,
        );
        if (hit) {
          grab();
          const np = p.length === 0 ? [hit.i] : [...p.slice(0, -1), hit.i];
          setPath(np);
          if (hit.it.sub) {
            const first = selectable(hit.it.sub)[0];
            if (first) setPath([...np, first.i]);
          } else {
            fire(hit.it);
          }
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // click outside closes
  useEffect(() => {
    if (open === null) return;
    const h = (e: MouseEvent) => {
      if (!barRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open ]);

  const renderItems = (items: WinMItem[], prefix: number[], trail: number[], sub: boolean) => (
    <ul className={sub ? "mdrop msub" : "mdrop"} role="menu">
      {items.map((item, i) => {
        if (item.sep) return <li key={item.id} className="msep" role="separator" />;
        const full = [...prefix, i];
        const isCur = trail[0] === i;
        return (
          <li
            key={item.id}
            role="menuitem"
            aria-disabled={item.disabled}
            className={
              "mitem" + (item.disabled ? " disabled" : "") + (isCur ? " cursor" : "")
            }
            onMouseEnter={() => {
              if (item.disabled) return;
              setPath(full);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled) return;
              if (!item.sub) fire(item);
            }}
          >
            <span className="mcheck">{item.checked ? "✓" : ""}</span>
            <span className="mlabel">{labelOf(t, item)}</span>
            {item.sc && <span className="msc">{item.sc}</span>}
            {item.sub && <span className="msub-arrow">▶</span>}
            {isCur && item.sub && renderItems(item.sub, full, trail.slice(1), true)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="menubar" ref={barRef} role="menubar">
      {menus.map((m, i) => (
        <div key={m.id} className="mtop-wrap">
          <button
            className={"mtop" + (open === i ? " open" : "")}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === i}
            title={`Alt+${m.mnemonic.toUpperCase()}`}
            onClick={() => (open === i ? close() : (setOpen(i), setPath([])))}
            onMouseEnter={() => {
              if (open !== null && open !== i) {
                setOpen(i);
                setPath([]);
              }
            }}
          >
            {t(m.label)}({m.mnemonic})
          </button>
          {open === i && renderItems(m.items, [], path, false)}
        </div>
      ))}
    </div>
  );
}
