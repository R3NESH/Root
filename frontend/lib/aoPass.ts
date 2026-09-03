// Ambient occlusion pass, with the scene's non-solid objects kept out of it.
//
// GTAOPass derives occlusion from a depth and normal render of the whole scene, taken with
// `scene.overrideMaterial` set to a MeshNormalMaterial. Everything visible writes depth in that
// pass, including things that are not geometry: the room badges are camera-facing sprites
// floating above each floor, and they would occlude the floor behind them as if they were
// solid, leaving a smudge under every label. The CAD grids and the drag ghosts have the same
// problem. Hiding them for the depth and normal render only — the beauty image is already in
// the read buffer by then — costs one traversal per frame and removes the artefact class.

import * as THREE from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

function isSolid(obj: THREE.Object3D): boolean {
  if (obj instanceof THREE.Sprite || obj instanceof THREE.Line || obj instanceof THREE.Points) {
    return false;
  }
  if (obj instanceof THREE.Mesh) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    // Glass falls out here too, which is correct — a window should not occlude the room.
    return !mats.some((m) => m && m.transparent);
  }
  return true;
}

export class SolidGeometryGTAOPass extends GTAOPass {
  private hidden: THREE.Object3D[] = [];

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    this.hidden.length = 0;
    this.scene.traverse((obj) => {
      if (obj.visible && !isSolid(obj)) {
        obj.visible = false;
        this.hidden.push(obj);
      }
    });

    try {
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    } finally {
      for (const obj of this.hidden) obj.visible = true;
      this.hidden.length = 0;
    }
  }
}
