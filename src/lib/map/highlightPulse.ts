import Graphic from "@arcgis/core/Graphic";
import type GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import type Geometry from "@arcgis/core/geometry/Geometry";

export interface PulseOptions {
  // Point options
  centerSize?: number;
  centerColor?: [number, number, number, number];
  centerOutlineColor?: [number, number, number, number];
  centerOutlineWidth?: number;
  ringMinSize?: number;
  ringMaxSize?: number;
  ringColor?: [number, number, number, number];
  ringOutlineColor?: [number, number, number, number];
  ringOutlineWidth?: number;
  ringStep?: number;


  // Polyline options 
  centerLineWidth?: number;          // base line width (px)
  ringLineMinWidth?: number;         // min animated width (px)
  ringLineMaxWidth?: number;         // max animated width (px)
  ringLineStep?: number;             // width delta per frame
}

type AnyLayer = GraphicsLayer & { [k: string]: any };

/**
 * Starts a pulsing highlight (orange center + blue ring) at the given geometry.
 * Returns a function to stop the animation and remove graphics.
 */
export function startPulsingHighlight(
  layer: GraphicsLayer,
  geometry: Geometry,
  options: PulseOptions = {}
): () => void {
  const l = layer as AnyLayer;

  // Stop any existing animation for safety
  stopPulsingHighlight(layer);

  const {
    // Point defaults
    centerSize = 8,
    centerColor = [255, 152, 0, 1], // #FF9800
    centerOutlineColor = [0, 0, 0, 1],
    centerOutlineWidth = 2,
    ringMinSize = 22,
    ringMaxSize = 40,
    ringColor = [33, 150, 243, 0], // transparent fill
    ringOutlineColor = [33, 150, 243, 0.8], // blue outline
    ringOutlineWidth = 2,
    ringStep = 0.6,

    // Polyline defaults
    centerLineWidth = 3,
    ringLineMinWidth = 6,
    ringLineMaxWidth = 14,
    ringLineStep = 0.5,
  } = options;

  const graphics: Graphic[] = [];
  let rafId: number | undefined;

  const animatePoint = () => {
    let size = ringMinSize;
    let growing = true;

    const centerGraphic = new Graphic({
      geometry,
      symbol: {
        type: "simple-marker",
        style: "circle",
        size: centerSize,
        color: centerColor,
        outline: { color: centerOutlineColor, width: centerOutlineWidth },
      } as any,
    });

    const ringGraphic = new Graphic({
      geometry,
      symbol: {
        type: "simple-marker",
        style: "circle",
        size,
        color: ringColor,
        outline: { color: ringOutlineColor, width: ringOutlineWidth },
      } as any,
    });

    layer.addMany([centerGraphic, ringGraphic]);
    graphics.push(centerGraphic, ringGraphic);

    const tick = () => {
      if (!layer) return;

      size += growing ? ringStep : -ringStep;
      if (size >= ringMaxSize) growing = false;
      if (size <= ringMinSize) growing = true;

      const t = Math.max(0, Math.min(1, (size - ringMinSize) / (ringMaxSize - ringMinSize)));
      const alpha = 0.8 * (1 - t) + 0.2;

      try {
        ringGraphic.symbol = {
          type: "simple-marker",
          style: "circle",
          size,
          color: ringColor,
          outline: {
            color: [ringOutlineColor[0], ringOutlineColor[1], ringOutlineColor[2], alpha],
            width: ringOutlineWidth,
          },
        } as any;
      } catch {
        return;
      }

      rafId = requestAnimationFrame(tick);
      (l.__pulseRafId as number | undefined) = rafId;
    };

    rafId = requestAnimationFrame(tick);
    (l.__pulseRafId as number | undefined) = rafId;
  };

  const animatePolyline = () => {
    let w = ringLineMinWidth;
    let growing = true;

    const baseLine = new Graphic({
      geometry,
      symbol: {
        type: "simple-line",
        color: centerColor,
        width: centerLineWidth,
        cap: "round",
        join: "round",
      } as any,
    });

    const pulseLine = new Graphic({
      geometry,
      symbol: {
        type: "simple-line",
        color: [ringOutlineColor[0], ringOutlineColor[1], ringOutlineColor[2], 0.8],
        width: w,
        cap: "round",
        join: "round",
      } as any,
    });

    layer.addMany([baseLine, pulseLine]);
    graphics.push(baseLine, pulseLine);

    const tick = () => {
      if (!layer) return;

      w += growing ? ringLineStep : -ringLineStep;
      if (w >= ringLineMaxWidth) growing = false;
      if (w <= ringLineMinWidth) growing = true;

      const t = Math.max(0, Math.min(1, (w - ringLineMinWidth) / (ringLineMaxWidth - ringLineMinWidth)));
      const alpha = 0.85 * (1 - t) + 0.15; // fade as width grows

      try {
        pulseLine.symbol = {
          type: "simple-line",
          color: [ringOutlineColor[0], ringOutlineColor[1], ringOutlineColor[2], alpha],
          width: w,
          cap: "round",
          join: "round",
        } as any;
      } catch {
        return;
      }

      rafId = requestAnimationFrame(tick);
      (l.__pulseRafId as number | undefined) = rafId;
    };

    rafId = requestAnimationFrame(tick);
    (l.__pulseRafId as number | undefined) = rafId;
  };
  console.log("Animating:", geometry);
  if ((geometry as any).type === "point") {
    animatePoint();
  } else {
    animatePolyline();
  }

  // Keep references for cleanup
  (l.__pulseGraphics as Graphic[] | undefined) = graphics;

  return () => stopPulsingHighlight(layer);

}

export function stopPulsingHighlight(layer: GraphicsLayer) {
  const l = layer as AnyLayer;
  if (l.__pulseRafId) {
    cancelAnimationFrame(l.__pulseRafId);
    l.__pulseRafId = undefined;
  }
  if (Array.isArray(l.__pulseGraphics)) {
    try {
      layer.removeMany(l.__pulseGraphics);
    } catch {}
    l.__pulseGraphics = undefined;
  }
}