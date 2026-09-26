import Dialog from "../components/Dialog";
import { useT } from "../i18n";

interface HelpDialogProps {
  onClose: () => void;
}

interface Row {
  keys: string;
  desc: string;
}

export default function HelpDialog({ onClose }: HelpDialogProps) {
  const t = useT();

  const sections: { title: string; rows: Row[] }[] = [
    {
      title: t("help.nav"),
      rows: [
        { keys: "↑ ↓ / PgUp PgDn / Home End", desc: t("help.move") },
        { keys: "Enter", desc: t("help.enter") },
        { keys: "Backspace", desc: t("help.parent") },
        { keys: "Tab", desc: t("help.switch") },
        { keys: "Alt+← / Alt+→", desc: t("help.histback") },
      ],
    },
    {
      title: t("help.sel"),
      rows: [
        { keys: "Space / Insert", desc: t("help.togglesel") },
        { keys: "U / Ctrl+A", desc: t("help.selall") },
        { keys: "V / Ctrl+I", desc: t("help.invert") },
        { keys: "N / Shift+N", desc: t("help.bypattern") },
        { keys: "Esc", desc: t("help.clearsel") },
      ],
    },
    {
      title: t("help.file"),
      rows: [
        { keys: "F2 / Ctrl+R", desc: t("help.refresh") },
        { keys: "F5 / C", desc: t("help.copy") },
        { keys: "F6 / R", desc: t("help.rename") },
        { keys: "F7 / K", desc: t("help.mkdir") },
        { keys: "F8 / Del / D", desc: t("help.delete") },
        { keys: "A", desc: t("help.archive") },
        { keys: "S", desc: t("help.split") },
        { keys: "O", desc: t("help.open") },
        { keys: "L", desc: t("help.flist") },
        { keys: "F", desc: t("help.filter") },
        { keys: "Z", desc: t("help.hidden") },
        { keys: "Alt+Enter", desc: t("help.props") },
      ],
    },
    {
      title: t("help.path"),
      rows: [
        { keys: "F10", desc: t("help.mcd") },
        { keys: "F11", desc: t("help.qcd") },
      ],
    },
    {
      title: t("help.app"),
      rows: [
        { keys: "F1", desc: t("help.help") },
        { keys: "F12 / Cmd+, / Ctrl+F12", desc: t("help.settings") },
      ],
    },
  ];

  return (
    <Dialog title={t("help.title")} onClose={onClose} wide>
      <div className="help-grid">
        {sections.map((s) => (
          <div key={s.title} className="help-sec">
            <h4>{s.title}</h4>
            <table>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.keys + r.desc}>
                    <td className="help-keys">{r.keys}</td>
                    <td>{r.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="primary" onClick={onClose}>
          {t("dlg.close")}
        </button>
      </div>
    </Dialog>
  );
}
