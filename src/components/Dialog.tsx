import { useEffect, useRef } from "react";
import { useT } from "../i18n";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Modal shell using native <dialog> element with showModal(). ESC to close. */
export default function Dialog({ title, onClose, children, wide }: DialogProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Open as modal
    if (!dialog.open) {
      dialog.showModal();
    }

    // Handle ESC and native close
    const handleClose = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);

    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`dlg${wide ? " wide" : ""}`}
      onClick={handleBackdropClick}
      aria-label={title}
    >
      <div className="dlg-content" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">
          <span>{title}</span>
          <button className="dlg-x" onClick={onClose} aria-label={t("dlg.close")}>
            ✕
          </button>
        </div>
        <div className="dlg-body">{children}</div>
      </div>
    </dialog>
  );
}
