"use client";

import { createImageUrlBuilder } from "@sanity/image-url";
import {
  type NumberInputProps,
  set,
  useClient,
  useFormValue,
} from "sanity";
import { useCallback, useMemo, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { DEFAULT_FLYER_VERTICAL_ALIGN } from "@/lib/eventFlyerUrl";

const muted: CSSProperties = {
  fontSize: "0.8125rem",
  opacity: 0.72,
  lineHeight: 1.45,
};

export function FlyerVerticalAlignInput(props: NumberInputProps) {
  const { value, onChange, renderDefault } = props;
  const client = useClient({ apiVersion: "2024-01-01" });
  const flyer = useFormValue(["flyer"]) as Record<string, unknown> | undefined;

  const imageUrl = useMemo(() => {
    if (!flyer?.asset) return null;
    try {
      return createImageUrlBuilder(client)
        .image(flyer as never)
        .width(720)
        .url();
    } catch {
      return null;
    }
  }, [client, flyer]);

  const y =
    typeof value === "number" && !Number.isNaN(value)
      ? Math.min(100, Math.max(0, value))
      : DEFAULT_FLYER_VERTICAL_ALIGN;

  const applyY = useCallback(
    (next: number) => {
      const clamped = Math.min(100, Math.max(0, Math.round(next)));
      onChange(set(clamped));
    },
    [onChange],
  );

  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startClientY: number; startAlign: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startClientY: e.clientY, startAlign: y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    const el = previewRef.current;
    if (!state || !el) return;
    const h = el.clientHeight;
    if (h < 1) return;
    const delta = e.clientY - state.startClientY;
    // Drag down → show more of the top of the art → lower Y.
    applyY(state.startAlign - (delta / h) * 100);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          borderRadius: 6,
          padding: "0.75rem",
          border: "1px solid color-mix(in srgb, var(--card-fg-color, #fff) 12%, transparent)",
          background: "color-mix(in srgb, var(--card-fg-color, #fff) 4%, transparent)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Square preview</div>
          <div style={muted}>
            Drag up or down on the square, or use the slider — matches the homepage / events tiles.
          </div>
          {imageUrl ? (
            <div
              ref={previewRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{
                touchAction: "none",
                cursor: "ns-resize",
                aspectRatio: "1",
                maxWidth: 320,
                width: "100%",
                overflow: "hidden",
                borderRadius: 4,
                background: "rgba(0,0,0,0.28)",
              }}
            >
              <img
                alt=""
                src={imageUrl}
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `center ${y}%`,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
          ) : (
            <div style={muted}>Upload a flyer above to preview framing here.</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <input
          aria-label="Vertical position"
          type="range"
          min={0}
          max={100}
          step={1}
          value={y}
          onChange={(e) => applyY(Number(e.target.value))}
          style={{ flex: 1, maxWidth: 280 }}
        />
        <span
          style={{
            minWidth: "2.5rem",
            fontVariantNumeric: "tabular-nums",
            fontSize: "0.8125rem",
          }}
        >
          {y}
        </span>
      </div>

      {renderDefault(props)}
    </div>
  );
}
