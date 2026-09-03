// Real 3D furniture for the built-in catalog.
//
// The pieces in furnitureCatalog.ts and the auto-furnished rooms in interiorDetails.ts are
// assembled from boxes and cylinders. This module maps the types worth replacing onto actual
// scanned models and swaps them in after the layout is built. Anything without a mapping keeps
// its procedural geometry, so this is additive — nothing regresses if a model fails to load.
//
// Assets are Poly Haven (CC0, no attribution required), committed under public/models at 1k
// geometry with textures halved to 512. See notes/assets/furniture-models.md.

import * as THREE from "three";
import { loadGlbModel } from "./modelLoader";

// Poly Haven models are modelled to real-world metric scale. The scene works in feet, so the
// only transform a model needs is a unit conversion — no fitting to the catalog's declared
// dimensions, which would distort pieces whose declared box was only ever a placement footprint.
const M_TO_FT = 3.280839895;

export interface ModelPart {
  /** Path under public/. */
  url: string;
  /** Offset from the item origin, in feet. +x right, +z toward the front of the piece. */
  x?: number;
  z?: number;
  /** Yaw in radians. Every seat and bed in the set faces +z with its back at -z, which is the
   *  same convention the procedural furniture uses, so a lone piece never needs one. */
  rotY?: number;
}

const p = (id: string) => `/models/${id}/${id}_1k.gltf`;

// Six chairs around dining_table (7.40ft x 4.56ft). Chairs on the far side are turned to face
// back at the table; the near side keeps the models' own +z facing.
const DINING_CHAIRS: ModelPart[] = [-2.2, 0, 2.2].flatMap((x) => [
  { url: p("dining_chair_02"), x, z: -3.4 },
  { url: p("dining_chair_02"), x, z: 3.4, rotY: Math.PI },
]);

// Keyed by FURNITURE_CATALOG `type` and by the `userData.type` the auto-furnished rooms tag
// their groups with — both go through the same swap, and the two vocabularies overlap but are
// not identical (the rooms emit "dining_table", the catalog calls it "dining_6seater").
export const FURNITURE_MODELS: Record<string, ModelPart[]> = {
  sofa_3seater: [{ url: p("Sofa_01") }],
  sofa_loveseat: [{ url: p("sofa_02") }],
  sofa_curved: [{ url: p("sofa_03") }],
  sofa_l_shape: [{ url: p("sofa_03") }],
  armchair: [{ url: p("ArmChair_01") }],
  cafe_lounge_armchair: [{ url: p("ArmChair_01") }],
  recliner_chair: [{ url: p("GreenChair_01") }],
  coffee_table: [{ url: p("CoffeeTable_01") }],
  wardrobe: [{ url: p("drawer_cabinet") }],
  bookshelf: [{ url: p("wooden_bookshelf_worn") }],
  cafe_bookshelf: [{ url: p("Shelf_01") }],
  cafe_retail_shelf: [{ url: p("Shelf_01") }],
  plant_pot: [{ url: p("potted_plant_02") }],
  cafe_floor_plant: [{ url: p("potted_plant_02") }],

  // Bed flanked by its nightstands, matching the arrangement the procedural bedroom builds.
  bed_king: [
    { url: p("GothicBed_01") },
    { url: p("ClassicNightstand_01"), x: -3.8, z: -2.45 },
    { url: p("ClassicNightstand_01"), x: 3.8, z: -2.45 },
  ],

  dining_6seater: [{ url: p("dining_table") }, ...DINING_CHAIRS],
  dining_table: [{ url: p("dining_table") }, ...DINING_CHAIRS],

  // Lounge grouping: sofa at the back, low round table in front, two chairs turned inward.
  sofa_boucle_curved_set: [
    { url: p("sofa_03"), z: -2.6 },
    { url: p("coffee_table_round_01"), z: 1.6 },
    { url: p("ArmChair_01"), x: -4.6, z: 1.6, rotY: Math.PI / 2 },
    { url: p("ArmChair_01"), x: 4.6, z: 1.6, rotY: -Math.PI / 2 },
  ],
};

export function hasFurnitureModel(type: string | undefined): boolean {
  return !!type && type in FURNITURE_MODELS;
}

async function buildPart(part: ModelPart): Promise<THREE.Group> {
  const raw = await loadGlbModel(part.url);
  raw.scale.setScalar(M_TO_FT);
  raw.updateMatrixWorld(true);

  // Seat the piece on the floor and centre its footprint on the origin, so the offsets above
  // mean the same thing whatever the exporter chose for the model's own pivot.
  const box = new THREE.Box3().setFromObject(raw);
  const centre = box.getCenter(new THREE.Vector3());
  raw.position.x -= centre.x;
  raw.position.z -= centre.z;
  raw.position.y -= box.min.y;

  raw.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const holder = new THREE.Group();
  holder.position.set(part.x ?? 0, 0, part.z ?? 0);
  holder.rotation.y = part.rotY ?? 0;
  holder.add(raw);
  return holder;
}

/**
 * Swaps the procedural contents of `host` for the real model of `type`, in place, once the
 * assets arrive. Only the children present at call time are removed, so anything added to the
 * host afterwards — the selection ring, most notably — survives the swap. A failed load leaves
 * the procedural geometry exactly as it was.
 */
export function mountFurnitureModel(
  host: THREE.Object3D,
  type: string,
  onLoaded?: () => void
): void {
  const parts = FURNITURE_MODELS[type];
  if (!parts) return;

  const superseded = host.children.slice();

  Promise.all(parts.map(buildPart))
    .then((loaded) => {
      for (const old of superseded) {
        host.remove(old);
        old.traverse((child) => {
          // Materials are shared across a room's pieces, so only the geometry is ours to drop.
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
      }
      loaded.forEach((part) => host.add(part));
      onLoaded?.();
    })
    .catch((err) => {
      console.warn(`Real model for "${type}" failed to load, keeping procedural geometry:`, err);
    });
}

/** Every group under `root` that has a real model waiting for it. */
export function mountRealModels(root: THREE.Object3D, onLoaded?: () => void): void {
  const targets: Array<{ host: THREE.Object3D; type: string }> = [];

  root.traverse((obj) => {
    const d = obj.userData;
    if (!d || (!d.isFurniture && !d.isCustomObject)) return;
    // Uploaded models and AI-generated parametric pieces already are what the user asked for.
    if (d.glbUrl || d.aiParametricDef) return;
    if (hasFurnitureModel(d.type)) targets.push({ host: obj, type: d.type });
  });

  targets.forEach((t) => mountFurnitureModel(t.host, t.type, onLoaded));
}
