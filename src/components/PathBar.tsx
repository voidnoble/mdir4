interface PathBarProps {
  path: string;
  filter: string;
  onOpen: () => void;
}

/**
 * App-level path bar (WinM classic): white sunken combo-box field showing
 * `path + separator + filter` (e.g. `C:\Downloads\*.*`); click opens the path dialog.
 */
export default function PathBar({ path, filter, onOpen }: PathBarProps) {
  const sep = path.includes("\\") ? "\\" : "/";
  const text = `${path}${path.endsWith(sep) ? "" : sep}${filter || "*.*"}`;

  const openOnKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div className="pathbar">
      <div
        className="path-field"
        title={text}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={openOnKey}
      >
        <span className="path-text">{text}</span>
        <span
          className="path-drop"
          role="button"
          tabIndex={-1}
          aria-label="open"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          ▼
        </span>
      </div>
    </div>
  );
}
