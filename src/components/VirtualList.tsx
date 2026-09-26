import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void;
  getPageSize: () => number;
}

interface VirtualListProps {
  itemCount: number;
  rowHeight: number;
  overscan?: number;
  resetKey?: string | number;
  renderRow: (index: number) => React.ReactNode;
}

const ROW_HEIGHT_DEFAULT = 24;

/**
 * Minimal fixed-row-height virtual list. Renders only the visible window
 * (+ overscan) inside an absolutely-positioned spacer.
 */
const VirtualList = forwardRef<VirtualListHandle, VirtualListProps>(function VirtualList(
  { itemCount, rowHeight = ROW_HEIGHT_DEFAULT, overscan = 6, resetKey, renderRow },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const ticking = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      scrollToIndex(index: number) {
        const el = containerRef.current;
        if (!el || index < 0) return;
        const top = index * rowHeight;
        const bottom = top + rowHeight;
        if (top < el.scrollTop) el.scrollTop = top;
        else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight;
      },
      getPageSize() {
        const el = containerRef.current;
        if (!el) return 20;
        return Math.max(1, Math.floor(el.clientHeight / rowHeight));
      },
    }),
    [rowHeight],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = 0;
    setScrollTop(0);
  }, [resetKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setViewportH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      ticking.current = false;
      const el = containerRef.current;
      if (el) setScrollTop(el.scrollTop);
    });
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(itemCount, Math.ceil((scrollTop + viewportH) / rowHeight) + overscan);

  const rows = [];
  for (let i = start; i < end; i++) {
    rows.push(
      <div
        key={i}
        className="vlist-row"
        style={{ top: i * rowHeight, height: rowHeight }}
      >
        {renderRow(i)}
      </div>,
    );
  }

  return (
    <div ref={containerRef} className="vlist" onScroll={onScroll}>
      <div className="vlist-spacer" style={{ height: itemCount * rowHeight }}>
        {rows}
      </div>
    </div>
  );
});

export default VirtualList;
