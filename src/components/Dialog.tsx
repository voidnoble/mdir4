import { useEffect } from "react";
import { useT } from "../i18n";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Modal shell: overlay + ESC to close. Inputs inside must stopPropagation keydown. */
export default function Dialog({ title, onClose, children, wide }: DialogProps) {
  const t = useT();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  return (
    <div className="dlg-overlay" onMouseDown={onClose}>
      <div
        className={`dlg${wide ? " wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="dlg-title">
          <span>{title}</span>
          <button className="dlg-x" onClick={onClose} aria-label={t("dlg.close")}>
            ✕
          </button>
        </div>
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  );
}
