// Canvas-drawn sprite labels that float over rooms in the 3D view.
//
// Extracted from Scene.tsx verbatim. Both are pure builders — they take text and return a
// fresh THREE.Sprite, touching nothing in the scene — which is what makes them separable
// from the 4,000-line render effect they used to sit above.

import * as THREE from "three";

/** Small pill used for the walkthrough's room readout. */
export function makeRoomBadgeSprite(text: string): THREE.Sprite {
  if (typeof document === "undefined") return new THREE.Sprite();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(19, 18, 16, 0.88)";
    if (ctx.roundRect) {
      ctx.roundRect(4, 4, 248, 56, 10);
    } else {
      ctx.rect(4, 4, 248, 56);
    }
    ctx.fill();
    ctx.strokeStyle = "#6f9aa8";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.5, 1.1, 1);
  return sprite;
}

/** Larger badge carrying the room name, its size in feet, and the drag/locked affordance. */
export function createRoomBadge(
  name: string,
  wFt: number,
  dFt: number,
  isLocked: boolean = false
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(26, 25, 22, 0.92)";
    ctx.roundRect(8, 12, 240, 104, 16);
    ctx.fill();
    ctx.strokeStyle = isLocked ? "rgba(111, 154, 168, 0.85)" : "rgba(184, 92, 34, 0.85)";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name.toUpperCase(), 128, 52);

    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${wFt}' × ${dFt}' ft`, 128, 84);

    ctx.fillStyle = isLocked ? "#6f9aa8" : "#b85c22";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(isLocked ? " View-Only Mode" : " Drag to Reposition", 128, 106);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.95 });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(4.4, 2.2, 1);
  return sprite;
}
