import type { Settings } from "sigma/settings";
import type { NodeDisplayData, PartialButFor } from "sigma/types";

/**
 * Dark-themed replacement for Sigma's default node-hover renderer, which
 * draws a white label box (illegible with our light label text). Used for
 * both hovered and highlighted/selected nodes.
 */
export function drawHover(
  context: CanvasRenderingContext2D,
  data: PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color">,
  settings: Settings,
): void {
  const label = data.label;
  if (typeof label !== "string") return;

  const size = settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;

  context.font = `${weight} ${size}px ${font}`;
  const textWidth = context.measureText(label).width;

  const x = Math.round(data.x);
  const y = Math.round(data.y);
  const boxHeight = size + 8;
  const left = x - data.size - 4;
  const boxWidth = data.size + 12 + textWidth + 8;

  // Subtle drop shadow for separation from the dimmed background.
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 2;
  context.shadowBlur = 8;
  context.shadowColor = "rgba(0,0,0,0.6)";

  // Dark rounded background box.
  context.fillStyle = "#18181b"; // zinc-900
  context.beginPath();
  roundRect(context, left, y - boxHeight / 2, boxWidth, boxHeight, 6);
  context.fill();

  // Reset shadow before drawing crisp foreground elements.
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;

  // Node disc on top of the box.
  context.fillStyle = data.color;
  context.beginPath();
  context.arc(x, y, data.size, 0, Math.PI * 2);
  context.closePath();
  context.fill();

  // Label text.
  context.fillStyle = "#f4f4f5"; // zinc-100
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(label, x + data.size + 6, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
