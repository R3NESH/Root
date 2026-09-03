import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

// Global cache for loaded GLTF/GLB models to prevent re-fetching
const modelCache = new Map<string, THREE.Group>();
const pendingPromises = new Map<string, Promise<THREE.Group>>();

let sharedGltfLoader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    // Configure optional DRACO compression loader if decoder is hosted
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    sharedGltfLoader.setDRACOLoader(dracoLoader);
  }
  return sharedGltfLoader;
}

/**
 * Normalizes an arbitrary 3D model to fit exact target dimensions (width, height, depth in feet)
 * and aligns its bottom to y=0 with center at (0, 0).
 */
export function normalizeModelDimensions(
  model: THREE.Group,
  targetWidthFt: number,
  targetHeightFt: number,
  targetDepthFt: number
): THREE.Group {
  const container = new THREE.Group();

  // Compute raw model bounding box
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    container.add(model);
    return container;
  }

  // Calculate non-uniform or uniform scale to fit target dimensions
  const scaleX = targetWidthFt / size.x;
  const scaleY = targetHeightFt / size.y;
  const scaleZ = targetDepthFt / size.z;

  // Use uniform scale matching the most constrained dimension to preserve proportions,
  // or clamp to prevent severe distortion
  const uniformScale = Math.min(scaleX, scaleY, scaleZ);

  model.scale.set(uniformScale, uniformScale, uniformScale);

  // Center model horizontally and seat bottom on floor (y = 0)
  model.position.x = -center.x * uniformScale;
  model.position.z = -center.z * uniformScale;
  model.position.y = -box.min.y * uniformScale;

  // Ensure all child meshes cast and receive soft shadows
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.side = THREE.DoubleSide;
      }
    }
  });

  container.add(model);
  return container;
}

/**
 * Loads a .glb or .gltf model from a URL with caching and error handling.
 */
export async function loadGlbModel(
  url: string,
  targetDims?: { widthFt: number; heightFt: number; depthFt: number }
): Promise<THREE.Group> {
  // Check memory cache
  const cached = modelCache.get(url);
  if (cached) {
    const clone = cached.clone(true);
    return targetDims
      ? normalizeModelDimensions(clone, targetDims.widthFt, targetDims.heightFt, targetDims.depthFt)
      : clone;
  }

  // Check in-flight requests
  let promise = pendingPromises.get(url);
  if (!promise) {
    const loader = getLoader();
    promise = new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const group = gltf.scene;
          modelCache.set(url, group);
          pendingPromises.delete(url);
          resolve(group);
        },
        undefined,
        (err) => {
          console.error(`Failed to load GLTF model from ${url}:`, err);
          pendingPromises.delete(url);
          reject(err);
        }
      );
    });
    pendingPromises.set(url, promise);
  }

  const baseGroup = await promise;
  const cloned = baseGroup.clone(true);
  return targetDims
    ? normalizeModelDimensions(cloned, targetDims.widthFt, targetDims.heightFt, targetDims.depthFt)
    : cloned;
}

/**
 * Loads a user-provided .glb or .gltf file from local disk (e.g. file input or drag-and-drop)
 */
export async function loadGlbFromFile(
  file: File,
  targetDims?: { widthFt: number; heightFt: number; depthFt: number }
): Promise<THREE.Group> {
  const url = URL.createObjectURL(file);
  try {
    const model = await loadGlbModel(url, targetDims);
    return model;
  } finally {
    // Keep blob URL in cache or revoke after timeout
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
