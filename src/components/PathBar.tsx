interface PathBarProps {
  path: string;
  filter: string;
  onOpen: () => void;
}

/**
 * App-level path bar (per macmdir-default-002.png): plain text on the flat
 * `#f0f0f0` chrome, `path + separator + filter` (e.g. `C:\Downloads\*.*`).
 * Click opens the path dialog.
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
    <div
      className="pathbar"
      title={text}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnKey}
    >
      {text}
    </div>
  );
}
