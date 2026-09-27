interface PathBarProps {
  path: string;
  onOpen: () => void;
}

/** App-level path bar: shows the active panel's path; click opens the path dialog. */
export default function PathBar({ path, onOpen }: PathBarProps) {
  return (
    <div className="pathbar">
      <div
        className="path-field"
        title={path}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {path}
      </div>
    </div>
  );
}
