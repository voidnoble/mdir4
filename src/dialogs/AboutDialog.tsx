import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import Dialog from "../components/Dialog";
import { fsShellOpen } from "../lib/fs";
import { useT } from "../i18n";

interface AboutDialogProps {
  onClose: () => void;
}

const HOMEPAGE = "https://github.com/voidnoble/mdir4";

export default function AboutDialog({ onClose }: AboutDialogProps) {
  const t = useT();
  const [version, setVersion] = useState("");

  useEffect(() => {
    void getVersion().then(setVersion).catch(() => {});
  }, []);

  const openHomepage = () => {
    void fsShellOpen(HOMEPAGE).catch(() => {});
  };

  return (
    <Dialog
      title={t("wm.help.about")}
      onClose={onClose}
      className="about-dialog"
      closeButton={false}
      closeOnBackdrop={false}
    >
      <div className="about-info">
        <strong>Mdir4</strong>
        {version && <span>{t("about.version", { version })}</span>}
      </div>
      <div className="about-inset" aria-hidden="true">
        <div className="about-inset-block" />
      </div>
      <div className="about-buttons">
        <button type="button" onClick={openHomepage}>
          {t("about.homepage")}
        </button>
        <button type="button" className="about-ok" onClick={onClose} autoFocus>
          {t("dlg.ok")}
        </button>
      </div>
    </Dialog>
  );
}
