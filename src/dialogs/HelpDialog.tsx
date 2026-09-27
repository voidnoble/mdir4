import Dialog from "../components/Dialog";
import { useT } from "../i18n";

interface HelpDialogProps {
  onClose: () => void;
}

interface Row {
  keys: string;
  desc: string;
}

/** Shortcut reference. Mirrors the WinM menu accelerators (winm-menus.png):
 *  every action is an Alt/Ctrl/Shift combo; plain letters are type-ahead search. */
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
        { keys: "Ctrl+BkSp", desc: t("help.lastfolder") },
      ],
    },
    {
      title: t("help.sel"),
      rows: [
        { keys: "Space / Insert", desc: t("help.togglesel") },
        { keys: "Ctrl+Num + / Ctrl+Num -", desc: t("help.bypattern") },
        { keys: "Num /", desc: t("help.sameext") },
        { keys: "Ctrl+Num /", desc: t("help.samename") },
        { keys: "Ctrl+Num *", desc: t("help.invert") },
        { keys: "Esc", desc: t("help.clearsel") },
      ],
    },
    {
      title: t("help.file"),
      rows: [
        { keys: "F2 / Ctrl+R", desc: t("help.refresh") },
        { keys: "F5 / Alt+C", desc: t("help.copy") },
        { keys: "F4 / Alt+M", desc: t("help.movefile") },
        { keys: "F6 / Alt+R", desc: t("help.rename") },
        { keys: "F7 / Alt+K", desc: t("help.mkdir") },
        { keys: "F8 / Del / Alt+D", desc: t("help.delete") },
        { keys: "Ctrl+A", desc: t("help.archive") },
        { keys: "Ctrl+X", desc: t("help.extract") },
        { keys: "Shift+Enter", desc: t("help.zipview") },
        { keys: "Ctrl+Alt+S/C/M", desc: t("help.split") },
        { keys: "Alt+V / Alt+G", desc: t("help.open") },
        { keys: "Alt+Enter / Ctrl+Z", desc: t("help.props") },
        { keys: "Alt+X", desc: t("help.quit") },
      ],
    },
    {
      title: t("help.view"),
      rows: [
        { keys: "Alt+Z", desc: t("help.hidden") },
        { keys: "Alt+N / Alt+E / Alt+S / Alt+T", desc: t("help.sort") },
        { keys: "Alt+-", desc: t("help.sortdir") },
        { keys: "Shift+Ctrl+1/2/3/0", desc: t("help.filter") },
        { keys: "Ctrl+Alt+Num +/-", desc: t("help.rowheight") },
        { keys: "Shift+Ctrl+P/H/S", desc: t("help.bars") },
      ],
    },
    {
      title: t("help.path"),
      rows: [
        { keys: "F10", desc: t("help.mcd") },
        { keys: "F11", desc: t("help.qcd") },
        { keys: "Shift+F12", desc: t("help.drive") },
        { keys: "Ctrl+G", desc: t("help.changepath") },
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
