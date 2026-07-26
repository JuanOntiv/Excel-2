import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ColorPicker } from "./ColorPicker";
import { clamp } from "../../utils/color";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  size?: number;
  title?: string;
}

const VIEWPORT_MARGIN = 8;

export function ColorPickerButton({ value, onChange, size = 20, title = "Elegir color" }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Posiciona el panel con `fixed` respecto al viewport (no al contenedor) y
  // en un portal a <body>, para que no lo recorten tablas/tarjetas con
  // overflow-hidden. Se recalcula si no cabe abajo o se sale de los bordes.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const btn = buttonRef.current;
      const panel = panelRef.current;
      if (!btn || !panel) return;
      const btnRect = btn.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      let top = btnRect.bottom + VIEWPORT_MARGIN;
      if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
        top = btnRect.top - panelRect.height - VIEWPORT_MARGIN;
      }
      top = clamp(top, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, window.innerHeight - panelRect.height - VIEWPORT_MARGIN));

      const left = clamp(
        btnRect.left,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, window.innerWidth - panelRect.width - VIEWPORT_MARGIN)
      );

      setPos({ top, left });
    }
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        className="rounded-full border border-line-light dark:border-line-dark shrink-0 cursor-pointer"
        style={{ width: size, height: size, backgroundColor: value }}
      />
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 rounded-xl border border-line-light dark:border-line-dark bg-surface-elevated-light dark:bg-surface-elevated-dark p-4 shadow-lg"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
          >
            <ColorPicker value={value} onChange={onChange} />
          </div>,
          document.body
        )}
    </>
  );
}
