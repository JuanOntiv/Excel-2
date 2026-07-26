import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clamp, hexToRgb, hsvToRgb, isValidHex, normalizeHex, rgbToHex, rgbToHsv } from "../../utils/color";

const SWATCHES = ["#2563eb", "#2dd4bf", "#dc2626", "#a855f7", "#f59e0b", "#059669", "#ec4899", "#78716c"];

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const rgb = hexToRgb(value);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // El HSV se mantiene aquí y no se recalcula del hex en cada interacción: el
  // matiz no es recuperable de un hex acromático (negro/blanco/gris, con s o v
  // en 0), y re-derivarlo dejaría la barra de matiz "congelada" en esos casos.
  const [hsv, setHsv] = useState(() => rgbToHsv(rgb.r, rgb.g, rgb.b));
  const [hexInput, setHexInput] = useState(value);
  // Último hex ya reflejado en `hsv`/`hexInput`. Si `value` difiere, el cambio
  // vino de fuera (swatch, campos hex/RGB, reset del padre) y toca re-derivar.
  const [syncedValue, setSyncedValue] = useState(value);

  if (value !== syncedValue) {
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setSyncedValue(value);
    setHexInput(value);
    setHsv((prev) => ({
      h: next.s === 0 || next.v === 0 ? prev.h : next.h,
      s: next.v === 0 ? prev.s : next.s,
      v: next.v,
    }));
  }

  function commitHsv(h: number, s: number, v: number) {
    const next = hsvToRgb(h, s, v);
    const hex = rgbToHex(next.r, next.g, next.b);
    setHsv({ h, s, v });
    setHexInput(hex);
    setSyncedValue(hex);
    onChange(hex);
  }

  // Captura el puntero en el propio elemento para que el arrastre siga
  // funcionando aunque el cursor se salga de él.
  function startDrag(
    el: HTMLDivElement,
    e: ReactPointerEvent<HTMLDivElement>,
    onMove: (clientX: number, clientY: number, rect: DOMRect) => void
  ) {
    el.setPointerCapture(e.pointerId);
    const move = (clientX: number, clientY: number) => onMove(clientX, clientY, el.getBoundingClientRect());

    function handleMove(ev: PointerEvent) {
      move(ev.clientX, ev.clientY);
    }
    function handleUp() {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerup", handleUp);
      el.removeEventListener("pointercancel", handleUp);
    }
    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerup", handleUp);
    el.addEventListener("pointercancel", handleUp);

    move(e.clientX, e.clientY);
  }

  function handleSquareDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = squareRef.current;
    if (!el) return;
    startDrag(el, e, (clientX, clientY, rect) => {
      const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const v = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);
      commitHsv(hsv.h, s, v);
    });
  }

  function handleHueDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = hueRef.current;
    if (!el) return;
    startDrag(el, e, (clientX, _clientY, rect) => {
      const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
      commitHsv(h, hsv.s, hsv.v);
    });
  }

  function handleHexChange(raw: string) {
    setHexInput(raw);
    if (isValidHex(raw)) onChange(normalizeHex(raw));
  }

  function handleRgbChange(channel: "r" | "g" | "b", raw: string) {
    const n = clamp(parseInt(raw, 10) || 0, 0, 255);
    const next = { ...rgb, [channel]: n };
    onChange(rgbToHex(next.r, next.g, next.b));
  }

  const pureHue = hsvToRgb(hsv.h, 100, 100);
  const hueColor = rgbToHex(pureHue.r, pureHue.g, pureHue.b);

  return (
    <div className="flex flex-col gap-3 w-56 text-ink-light dark:text-ink-dark">
      <div
        ref={squareRef}
        onPointerDown={handleSquareDown}
        className="relative w-full h-36 rounded-lg cursor-crosshair touch-none select-none"
        style={{
          backgroundColor: hueColor,
          backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
        }}
      >
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: value }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={handleHueDown}
        className="relative w-full h-4 rounded-full cursor-pointer touch-none select-none"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
        />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="w-8 h-8 rounded-lg border border-line-light dark:border-line-dark shrink-0"
          style={{ backgroundColor: value }}
        />
        <input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          spellCheck={false}
          maxLength={7}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-ink-light dark:text-ink-dark text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="flex flex-col gap-1">
            <span className="text-[11px] uppercase text-ink-muted-light dark:text-ink-muted-dark">{channel}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(e) => handleRgbChange(channel, e.target.value)}
              className="w-full px-2 py-1 rounded-lg border border-line-light dark:border-line-dark bg-transparent text-ink-light dark:text-ink-dark text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className="w-5 h-5 rounded-full border border-line-light dark:border-line-dark cursor-pointer"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}
