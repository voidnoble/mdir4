import type { ReactNode } from "react";

export interface ToolDef {
  id: string;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}

/**
 * Icon bar below the title bar (WinM classic toolbar).
 * Mouse-centric; keyboard users keep using shortcuts (buttons are tabIndex=-1
 * so Tab stays reserved for panel switching).
 */
export default function Toolbar({ tools }: { tools: ToolDef[] }) {
  return (
    <div className="toolbar" role="toolbar" aria-label="toolbar">
      {tools.map((t) => (
        <span key={t.id} className="tool-wrap">
          {(t.id === "mcd" || t.id === "settings") && <span className="tool-sep" />}
          <button
            className="tool-btn"
            title={t.title}
            aria-label={t.title}
            onClick={t.onClick}
            tabIndex={-1}
          >
            {t.icon}
          </button>
        </span>
      ))}
    </div>
  );
}
