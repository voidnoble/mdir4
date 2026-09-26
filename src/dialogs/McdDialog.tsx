import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "../components/Dialog";
import type { TreeNode } from "../lib/fs";
import { fsRoots, fsTreeChildren } from "../lib/fs";
import { useT } from "../i18n";

interface McdDialogProps {
  onClose: () => void;
  onSelect: (path: string) => void;
}

interface VisNode {
  node: TreeNode;
  depth: number;
}

/** MCD: lazy directory tree. ↑↓ move, → expand, ← collapse, Enter jump. */
export default function McdDialog({ onClose, onSelect }: McdDialogProps) {
  const t = useT();
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fsRoots()
      .then((r) => {
        if (!cancelled) setRoots(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo<VisNode[]>(() => {
    const out: VisNode[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      for (const n of nodes) {
        out.push({ node: n, depth });
        if (expanded.has(n.path)) {
          walk(children[n.path] ?? [], depth + 1);
        }
      }
    };
    walk(roots, 0);
    return out;
  }, [roots, children, expanded]);

  const expand = async (node: TreeNode) => {
    if (expanded.has(node.path)) {
      setExpanded((s) => {
        const next = new Set(s);
        next.delete(node.path);
        return next;
      });
      return;
    }
    if (!children[node.path] && !loading.has(node.path)) {
      setLoading((s) => new Set(s).add(node.path));
      try {
        const kids = await fsTreeChildren(node.path);
        setChildren((c) => ({ ...c, [node.path]: kids }));
      } catch {
        /* ignore */
      } finally {
        setLoading((s) => {
          const next = new Set(s);
          next.delete(node.path);
          return next;
        });
      }
    }
    setExpanded((s) => new Set(s).add(node.path));
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(".tnode.cursor");
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const cur = visible[cursor];
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => Math.min(visible.length - 1, c + 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        if (cur?.node.hasChildren) void expand(cur.node);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (cur && expanded.has(cur.node.path)) {
          void expand(cur.node);
        } else if (cur && cur.depth > 0) {
          // move to parent
          for (let i = cursor - 1; i >= 0; i--) {
            if (visible[i].depth === cur.depth - 1) {
              setCursor(i);
              break;
            }
          }
        }
        break;
      case "Enter":
        e.preventDefault();
        if (cur) onSelect(cur.node.path);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <Dialog title={t("mcd.title")} onClose={onClose} wide>
      <div className="form" onKeyDown={onKey}>
        <div ref={listRef} className="tree-list" tabIndex={0} autoFocus>
          {visible.map((v, i) => (
            <div
              key={v.node.path}
              className={`tnode${i === cursor ? " cursor" : ""}`}
              style={{ paddingLeft: 8 + v.depth * 18 }}
              onClick={() => setCursor(i)}
              onDoubleClick={() => onSelect(v.node.path)}
            >
              <span
                className="tcaret"
                onClick={(e) => {
                  e.stopPropagation();
                  setCursor(i);
                  if (v.node.hasChildren) void expand(v.node);
                }}
              >
                {v.node.hasChildren ? (expanded.has(v.node.path) ? "▾" : "▸") : "·"}
              </span>
              📁 {v.node.name}
              {loading.has(v.node.path) && " …"}
            </div>
          ))}
          {visible.length === 0 && <div className="hint">{t("mcd.loading")}</div>}
        </div>
        <div className="progress-meta">
          <span className="hint">{visible[cursor]?.node.path}</span>
        </div>
        <div className="btn-row">
          <button
            className="primary"
            disabled={visible.length === 0}
            onClick={() => visible[cursor] && onSelect(visible[cursor].node.path)}
          >
            {t("mcd.select")}
          </button>
          <button onClick={onClose}>{t("dlg.cancel")}</button>
        </div>
      </div>
    </Dialog>
  );
}
