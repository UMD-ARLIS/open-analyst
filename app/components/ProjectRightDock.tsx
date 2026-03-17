import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";

const MIN_WIDTH = 360;
const MAX_WIDTH = 1400;
const DEFAULT_WIDTHS: Record<string, number> = {
  sources: 540,
  canvas: 760,
  artifact: 680,
};

function getStorageKey(mode: string) {
  return `open-analyst:right-dock:${mode}:width`;
}

function getInitialWidth(mode: string) {
  if (typeof window === "undefined") {
    return DEFAULT_WIDTHS[mode] || 600;
  }
  const saved = window.localStorage.getItem(getStorageKey(mode));
  const parsed = saved ? Number(saved) : Number.NaN;
  if (Number.isFinite(parsed)) {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
  }
  return DEFAULT_WIDTHS[mode] || 600;
}

interface ProjectRightDockProps {
  mode: "sources" | "canvas" | "artifact";
  children: React.ReactNode;
}

export function ProjectRightDock({ mode, children }: ProjectRightDockProps) {
  const [width, setWidth] = useState(() => getInitialWidth(mode));
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    setWidth(getInitialWidth(mode));
  }, [mode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(getStorageKey(mode), String(width));
    }
  }, [mode, width]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDragging.current = true;
      startX.current = event.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - event.clientX;
      const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  return (
    <div
      className="border-l border-border bg-surface flex flex-col shrink-0 relative min-h-0"
      style={{ width }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute -left-3 top-0 bottom-0 w-6 cursor-col-resize z-20 flex items-center justify-center"
      >
        <div className="w-4 h-8 rounded bg-surface border border-border shadow-sm flex items-center justify-center hover:bg-surface-hover hover:border-accent/40 transition-colors">
          <GripVertical className="w-3 h-3 text-text-muted" />
        </div>
      </div>
      {children}
    </div>
  );
}
