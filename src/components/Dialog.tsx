import { useEffect, useRef } from "react";
import { useT } from "../i18n";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  className?: string;
  closeButton?: boolean;
  closeOnBackdrop?: boolean;
}

/** Modal shell using native <dialog> element with showModal(). ESC to close. */
export default function Dialog({
  title,
  onClose,
  children,
  wide,
  className,
  closeButton = true,
  closeOnBackdrop = true,
}: DialogProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Open as modal
    if (!dialog.open) {
      dialog.showModal();
    }

    // Handle ESC. Ignore native close events: cleanup closes the element, and
    // browsers may dispatch that event after the next effect setup has reopened it.
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };

    dialog.addEventListener("cancel", handleCancel);

    return () => {
      dialog.removeEventListener("cancel", handleCancel);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

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

    if (!isInDialog && closeOnBackdrop) {
      onCloseRef.current();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`dlg${wide ? " wide" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleBackdropClick}
      aria-label={title}
    >
      <div className="dlg-content" onClick={(e) => e.stopPropagation()}>
        <div className="dlg-title">
          <span>{title}</span>
          {closeButton && (
            <button className="dlg-x" onClick={onClose} aria-label={t("dlg.close")}>
              ✕
            </button>
          )}
        </div>
        <div className="dlg-body">{children}</div>
      </div>
    </dialog>
  );
}
