interface PathBarProps {
  path: string;
  filter: string;
  /** type-ahead search buffer; shown in the green box at the bar's right end */
  searchBuf: string;
  onOpen: () => void;
  /** active panel: peach background (#f4b99c), inactive: #f0f0f0 */
  active?: boolean;
}

/**
 * Per-panel path bar (WinM reference): flat, `path + separator + filter`
 * (e.g. `C:\Downloads\*.*`). The active panel's bar is peach (#f4b99c);
 * inactive panels use #f0f0f0. Click opens the path dialog.
 */
export default function PathBar({ path, filter, searchBuf, onOpen, active = false }: PathBarProps) {
  const sep = path.includes("\\") ? "\\" : "/";
  const text = `${path}${path.endsWith(sep) ? "" : sep}${filter || "*.*"}`;

  const openOnKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className={`pathbar${active ? " active" : ""}`}
      title={text}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnKey}
    >
      <span className="pathbar-text">{text}</span>
      {searchBuf && <span className="search-box">{searchBuf}</span>}
    </div>
  );
}
