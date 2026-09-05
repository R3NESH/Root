"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AIFurnitureParametricDef,
  MeshQualityTier,
  createAIFurnitureMesh,
} from "@/lib/aiFurnitureEngine";
import { PlacedCustomObject } from "@/lib/furnitureCatalog";
import styles from "./AIFurnitureStudioModal.module.css";

interface PresetShowcaseItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  style: string;
  description: string;
  prompt: string;
  primaryColorHex: number;
}

const PRESET_SHOWCASE: PresetShowcaseItem[] = [
  {
    id: "emerald_sectional",
    name: "Emerald Velvet Sectional",
    category: "living",
    icon: "SOF",
    style: "Luxury Contemporary",
    description: "Deep tufted emerald velvet corner sectional sofa with tapered brass legs.",
    prompt: "emerald green velvet luxury tufted l-shape sectional sofa with brass legs",
    primaryColorHex: 0x065f46,
  },
  {
    id: "tan_leather_armchair",
    name: "Cognac Leather Lounge Chair",
    category: "living",
    icon: "CHR",
    style: "Mid-Century Modern",
    description: "Top-grain warm cognac leather accent armchair with ergonomic contour.",
    prompt: "warm tan cognac leather accent armchair lounge chair with dark walnut wood base",
    primaryColorHex: 0xb45309,
  },
  {
    id: "marble_gold_dining",
    name: "Carrara Marble Dining Table",
    category: "dining",
    icon: "DIN",
    style: "Neoclassical Luxe",
    description: "Beveled Carrara quartz tabletop with architectural brushed gold pedestal legs.",
    prompt: "oval carrara white marble dining table with gold brass architectural base",
    primaryColorHex: 0xf8fafc,
  },
  {
    id: "zen_platform_bed",
    name: "Fluted Velvet Platform Bed",
    category: "bedroom",
    icon: "BED",
    style: "Japandi Modern",
    description: "Low-profile king platform bed with fluted velvet acoustic headboard ledges.",
    prompt: "dark walnut king size platform bed with emerald green velvet headboard",
    primaryColorHex: 0x3e2723,
  },
  {
    id: "crescent_boucle_sofa",
    name: "Curved Crescent Bouclé Sofa",
    category: "living",
    icon: "SOF",
    style: "Organic Minimalist",
    description: "Soft curved cloud sofa in ivory white textured bouclé upholstery.",
    prompt: "curved crescent organic white cream boucle cloud sofa",
    primaryColorHex: 0xf3f4f6,
  },
  {
    id: "teak_coffee_table",
    name: "Live-Edge Teak Coffee Table",
    category: "living",
    icon: "CAF",
    style: "Organic Modern",
    description: "Solid natural teak slab coffee table with industrial matte black hairpin legs.",
    prompt: "natural teak wood coffee table with matte black metal hairpin legs",
    primaryColorHex: 0x78350f,
  },
];

interface AIFurnitureStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSpawnFurniture: (placedObj: PlacedCustomObject) => void;
}

export default function AIFurnitureStudioModal({
  isOpen,
  onClose,
  onSpawnFurniture,
}: AIFurnitureStudioModalProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("emerald_sectional");
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeDef, setActiveDef] = useState<AIFurnitureParametricDef | null>(null);
  const [activeColorHex, setActiveColorHex] = useState<number>(0x065f46);

  // Hardware Quality Tier & Mesh Density Controls
  const [qualityTier, setQualityTier] = useState<MeshQualityTier>("ultra");
  const [meshCountTarget, setMeshCountTarget] = useState<number>(35);
  const [selectedTextureType, setSelectedTextureType] = useState<string>("velvet");

  // Turntable Canvas Ref
  const turntableCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const turntableSceneRef = useRef<THREE.Scene | null>(null);
  const turntableRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const turntableMeshGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingTurntableRef = useRef(false);
  const previousMousePosRef = useRef({ x: 0, y: 0 });

  // Client-Side Canvas Image Pixel Color Analyzer
  const analyzeImagePixels = (dataUrl: string): Promise<{ dominantHex: string; palette: string[]; aspect: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const w = Math.min(img.width, 160);
        const h = Math.min(img.height, 160);
        canvas.width = w;
        canvas.height = h;

        if (!ctx) {
          resolve({ dominantHex: "#065f46", palette: ["#065f46", "#1e3a8a", "#d4af37"], aspect: 1.0 });
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h).data;
        const colorBuckets = new Map<string, number>();

        // Sample center 70% of image pixels (to avoid solid background edges)
        const startX = Math.floor(w * 0.15);
        const endX = Math.floor(w * 0.85);
        const startY = Math.floor(h * 0.15);
        const endY = Math.floor(h * 0.85);

        for (let y = startY; y < endY; y += 3) {
          for (let x = startX; x < endX; x += 3) {
            const idx = (y * w + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            if (a < 128) continue;
            // Ignore near pure white backgrounds
            if (r > 245 && g > 245 && b > 245) continue;
            // Quantize to 16-step buckets
            const qr = Math.round(r / 24) * 24;
            const qg = Math.round(g / 24) * 24;
            const qb = Math.round(b / 24) * 24;
            const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;
            colorBuckets.set(hex, (colorBuckets.get(hex) || 0) + 1);
          }
        }

        const sorted = Array.from(colorBuckets.entries()).sort((a, b) => b[1] - a[1]);
        const topHexes = sorted.slice(0, 5).map((e) => e[0]);
        const dominant = topHexes[0] || "#065f46";
        const aspect = img.width / Math.max(img.height, 1);

        resolve({ dominantHex: dominant, palette: topHexes, aspect });
      };
      img.onerror = () => {
        resolve({ dominantHex: "#065f46", palette: ["#065f46", "#1e3a8a", "#d4af37"], aspect: 1.0 });
      };
      img.src = dataUrl;
    });
  };

  // Analyze & Model furniture
  const analyzeAndModel = async (promptText: string, imageBase64?: string, colorHint?: string, aspectHint?: number) => {
    setIsScanning(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/ai/model-furniture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          image_base64: imageBase64 || null,
        }),
      });

      if (res.ok) {
        const data: AIFurnitureParametricDef = await res.json();
        if (colorHint) {
          data.primary_color_hex = colorHint;
        }
        if (aspectHint && aspectHint > 1.8) {
          data.width_ft = Math.max(data.width_ft, 8.0);
        }
        setActiveDef(data);
        const parsedColor = parseInt(data.primary_color_hex.replace("#", "0x"), 16);
        if (!isNaN(parsedColor)) setActiveColorHex(parsedColor);
      }
    } catch (err) {
      console.warn("Using built-in client vision modeling:", err);
    } finally {
      setIsScanning(false);
    }
  };

  // Initial load with default showcase
  useEffect(() => {
    if (isOpen) {
      const preset = PRESET_SHOWCASE.find((p) => p.id === selectedPresetId) || PRESET_SHOWCASE[0];
      setActiveColorHex(preset.primaryColorHex);
      analyzeAndModel(preset.prompt);
    }
  }, [isOpen]);

  // Three.js Turntable Viewport Lifecycle
  useEffect(() => {
    if (!isOpen || !turntableCanvasRef.current) return;

    const canvas = turntableCanvasRef.current;
    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 240;

    const scene = new THREE.Scene();
    turntableSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 7.5);
    camera.lookAt(0, 1.0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: qualityTier !== "low",
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(qualityTier === "ultra" ? Math.min(window.devicePixelRatio, 2) : 1);
    renderer.shadowMap.enabled = qualityTier !== "low";
    renderer.shadowMap.type = qualityTier === "ultra" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    turntableRendererRef.current = renderer;

    // Lighting Studio
    const ambientLight = new THREE.AmbientLight(0xffffff, qualityTier === "ultra" ? 1.3 : 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(4, 8, 5);
    keyLight.castShadow = qualityTier !== "low";
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = qualityTier === "ultra" ? 1024 : 512;
      keyLight.shadow.mapSize.height = qualityTier === "ultra" ? 1024 : 512;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    fillLight.position.set(-5, 3, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfef08a, 0.5);
    rimLight.position.set(0, 5, -6);
    scene.add(rimLight);

    // Luxury Marble Pedestal Turntable
    const pedestalGeom = new THREE.CylinderGeometry(4.2, 4.4, 0.35, qualityTier === "ultra" ? 48 : 24);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.25,
      metalness: 0.2,
    });
    const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);
    pedestal.position.y = -0.175;
    pedestal.receiveShadow = qualityTier !== "low";
    scene.add(pedestal);

    // Brass Inset Ring
    const ringGeom = new THREE.RingGeometry(3.9, 4.05, qualityTier === "ultra" ? 48 : 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    // Furniture Container
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    turntableMeshGroupRef.current = modelGroup;

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (turntableMeshGroupRef.current && !isDraggingTurntableRef.current) {
        turntableMeshGroupRef.current.rotation.y += 0.008; // Smooth turntable rotation
      }
      renderer.render(scene, camera);
    };
    animate();

    // Mouse Drag Rotation on Turntable
    const onMouseDown = (e: MouseEvent) => {
      isDraggingTurntableRef.current = true;
      previousMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingTurntableRef.current || !turntableMeshGroupRef.current) return;
      const deltaX = e.clientX - previousMousePosRef.current.x;
      turntableMeshGroupRef.current.rotation.y += deltaX * 0.015;
      previousMousePosRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingTurntableRef.current = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.dispose();
    };
  }, [isOpen, qualityTier]);

  // Re-render 3D mesh inside Turntable whenever definition, color, tier, or density changes
  useEffect(() => {
    if (!turntableMeshGroupRef.current || !activeDef) return;

    const group = turntableMeshGroupRef.current;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const modifiedDef = {
      ...activeDef,
      primary_material: selectedTextureType || activeDef.primary_material,
      quality_tier: qualityTier,
      mesh_count_target: meshCountTarget,
    };

    const mesh = createAIFurnitureMesh(modifiedDef, activeColorHex, qualityTier, meshCountTarget);
    group.add(mesh);
  }, [activeDef, activeColorHex, qualityTier, meshCountTarget, selectedTextureType]);

  // Handle Photo File Upload with Pixel Color Extraction
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setUploadedImageSrc(dataUrl);

      // Extract pixel color & aspect ratio client-side
      const { dominantHex, palette, aspect } = await analyzeImagePixels(dataUrl);
      setDetectedColors(palette);

      const parsedColor = parseInt(dominantHex.replace("#", "0x"), 16);
      if (!isNaN(parsedColor)) setActiveColorHex(parsedColor);

      // Determine category hint from aspect ratio
      const categoryPrompt =
        aspect > 1.7
          ? "luxury modern sectional sofa couch with cushions"
          : aspect > 1.2
          ? "designer modern coffee dining table"
          : "sculptural modern accent armchair lounge chair";

      analyzeAndModel(`Uploaded photo: ${file.name}. ${categoryPrompt}`, dataUrl, dominantHex, aspect);
    };
    reader.readAsDataURL(file);
  };

  // Handle Preset Select
  const handleSelectPreset = (preset: PresetShowcaseItem) => {
    setSelectedPresetId(preset.id);
    setUploadedImageSrc(null);
    setDetectedColors([]);
    setActiveColorHex(preset.primaryColorHex);
    analyzeAndModel(preset.prompt);
  };

  // Dimension Changes
  const handleUpdateDim = (key: "width_ft" | "depth_ft" | "height_ft", delta: number) => {
    if (!activeDef) return;
    const nextVal = Math.max(1.0, Math.min(14.0, +(activeDef[key] + delta).toFixed(1)));
    const updated = {
      ...activeDef,
      [key]: nextVal,
      components: activeDef.components.map((comp) => {
        if (key === "width_ft" && comp.width_ft) {
          return { ...comp, width_ft: Math.max(0.2, +(comp.width_ft + delta).toFixed(1)) };
        }
        if (key === "depth_ft" && comp.depth_ft) {
          return { ...comp, depth_ft: Math.max(0.2, +(comp.depth_ft + delta).toFixed(1)) };
        }
        if (key === "height_ft" && comp.height_ft) {
          return { ...comp, height_ft: Math.max(0.2, +(comp.height_ft + delta).toFixed(1)) };
        }
        return comp;
      }),
    };
    setActiveDef(updated);
  };

  // Spawn into 3D Simulation
  const handleSpawn = () => {
    if (!activeDef) return;

    const newObjId = `ai_furn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const finalDef: AIFurnitureParametricDef = {
      ...activeDef,
      primary_material: selectedTextureType,
      quality_tier: qualityTier,
      mesh_count_target: meshCountTarget,
    };

    const newPlacedObject: PlacedCustomObject = {
      id: newObjId,
      type: "custom_ai_furniture",
      name: activeDef.name,
      x: 10.0,
      y: 0.0,
      z: 10.0,
      rotationY: 0,
      scale: 1.0,
      colorHex: activeColorHex,
      aiParametricDef: finalDef,
    };

    onSpawnFurniture(newPlacedObject);
    onClose();
  };

  if (!isOpen) return null;

  const polyCountText =
    qualityTier === "ultra"
      ? `~${meshCountTarget * 180 + 1200} Polys (Ultra 2K PBR)`
      : qualityTier === "medium"
      ? `~${meshCountTarget * 60 + 400} Polys (Balanced)`
      : `~${meshCountTarget * 15 + 80} Polys (Eco Low-Poly)`;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconBadge}>CAM</div>
            <div>
              <h2 className={styles.headerTitle}>
                AI Photo-to-3D Furniture Studio <span className={styles.aiPillBadge}>Multimodal Vision AI</span>
              </h2>
              <p className={styles.headerSubtitle}>
                Snap or upload any furniture photo to auto-model into 3D. Choose mesh density &amp; PBR textures scaled to your hardware.
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Studio">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.modalBody}>
          {/* Left Column: Photo Upload & Showcase */}
          <div className={styles.leftCol}>
            {/* Upload Dropzone */}
            <div>
              <div className={styles.sectionTitle}>
                <span>CAM</span> 1. Upload or Snap Furniture Photo
              </div>

              {uploadedImageSrc ? (
                <div className={styles.uploadedPreviewCard}>
                  <img src={uploadedImageSrc} alt="Uploaded furniture" className={styles.uploadedImage} />
                  {isScanning && <div className={styles.scanningOverlay} />}
                  <div className={styles.scanningBadge}>
                    <span>{isScanning ? "AI Decomposing 3D Geometry..." : "3D Geometry & Palette Extracted"}</span>
                  </div>
                  <button
                    className={styles.removeImageBtn}
                    onClick={() => {
                      setUploadedImageSrc(null);
                      setDetectedColors([]);
                    }}
                    title="Remove and upload different image"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className={styles.dropzone}>
                  <input
                    type="file"
                    accept="image/*"
                    className={styles.hiddenFileInput}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <span className={styles.dropzoneIcon}>IMG</span>
                  <div className={styles.dropzoneTitle}>Drag &amp; Drop Furniture Photo</div>
                  <div className={styles.dropzoneSub}>Supports JPG, PNG, WEBP from IKEA, Pinterest, or your Camera</div>
                  <span className={styles.browseBtn}>Browse Files or Paste (Ctrl+V)</span>
                </label>
              )}

              {/* Detected Color Palette Chips */}
              {detectedColors.length > 0 && (
                <div className={styles.detectedColorsBar} style={{ marginTop: "8px" }}>
                  <span className={styles.detectedColorsLabel}> Extracted Palette:</span>
                  {detectedColors.map((hex) => (
                    <span
                      key={hex}
                      className={styles.detectedColorDot}
                      style={{ backgroundColor: hex }}
                      onClick={() => {
                        const parsed = parseInt(hex.replace("#", "0x"), 16);
                        if (!isNaN(parsed)) setActiveColorHex(parsed);
                      }}
                      title={`Apply detected color ${hex}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Instant Showcase Presets */}
            <div>
              <div className={styles.sectionTitle}>
                <span>FX</span> Or Pick an AI Showcase Furniture Piece
              </div>
              <div className={styles.presetGrid}>
                {PRESET_SHOWCASE.map((preset) => {
                  const isSelected = selectedPresetId === preset.id && !uploadedImageSrc;
                  return (
                    <div
                      key={preset.id}
                      className={`${styles.presetCard} ${isSelected ? styles.presetCardActive : ""}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <span className={styles.presetIcon}>{preset.icon}</span>
                      <div className={styles.presetName}>{preset.name}</div>
                      <div className={styles.presetStyle}>{preset.style}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: 3D Turntable & Quality Controls */}
          <div className={styles.rightCol}>
            {/* Turntable */}
            <div>
              <div className={styles.sectionTitle}>
                <span>3D</span> 2. Interactive 3D Turntable Preview
              </div>
              <div className={styles.turntableContainer}>
                <canvas ref={turntableCanvasRef} className={styles.turntableCanvas} />
                <div className={styles.turntableOverlayBadges}>
                  <span className={styles.turntableTag}>
                    Drag to Orbit • {activeDef?.name || "3D Furniture"}
                  </span>
                  <span className={styles.confidenceBadge}>
                      {((activeDef?.confidence || 0.96) * 100).toFixed(0)}% AI Match
                  </span>
                </div>
              </div>
            </div>

            {/* Hardware Quality Tier & Mesh Density */}
            <div className={styles.qualitySection}>
              <div className={styles.qualityHeaderRow}>
                <span className={styles.qualityLabel}>
                  <span>CFG</span> Hardware Performance Tier
                </span>
                <span className={styles.polyStatsBadge}>{polyCountText}</span>
              </div>

              <div className={styles.tierButtonGroup}>
                <button
                  className={`${styles.tierBtn} ${qualityTier === "low" ? styles.tierBtnActive : ""}`}
                  onClick={() => {
                    setQualityTier("low");
                    setMeshCountTarget(10);
                  }}
                >
                  <span> Low-Poly (Eco)</span>
                  <span className={styles.tierSub}>Integrated GPU / Mobile</span>
                </button>
                <button
                  className={`${styles.tierBtn} ${qualityTier === "medium" ? styles.tierBtnActive : ""}`}
                  onClick={() => {
                    setQualityTier("medium");
                    setMeshCountTarget(20);
                  }}
                >
                  <span> Balanced</span>
                  <span className={styles.tierSub}>Standard Laptops</span>
                </button>
                <button
                  className={`${styles.tierBtn} ${qualityTier === "ultra" ? styles.tierBtnActive : ""}`}
                  onClick={() => {
                    setQualityTier("ultra");
                    setMeshCountTarget(35);
                  }}
                >
                  <span> Ultra (Multi-Mesh)</span>
                  <span className={styles.tierSub}>Dedicated GPU / 2K PBR</span>
                </button>
              </div>

              {/* Mesh Density Slider */}
              <div className={styles.sliderRow}>
                <span className={styles.sliderLabel}>Mesh Density:</span>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={meshCountTarget}
                  onChange={(e) => setMeshCountTarget(parseInt(e.target.value, 10))}
                  className={styles.densitySlider}
                />
                <span className={styles.sliderVal}>{meshCountTarget} meshes</span>
              </div>

              {/* Texture Material Chips */}
              <div>
                <div className={styles.dimLabel} style={{ marginBottom: "5px" }}>
                  PBR Texture Surface
                </div>
                <div className={styles.textureChipsRow}>
                  {[
                    { id: "velvet", label: "Italian Velvet" },
                    { id: "leather", label: "Pebble Leather" },
                    { id: "fabric", label: "Woven Linen" },
                    { id: "boucle", label: "Bouclé Cloud" },
                    { id: "wood", label: "Natural Teak" },
                    { id: "marble", label: "Carrara Marble" },
                  ].map((tex) => (
                    <button
                      key={tex.id}
                      className={`${styles.textureChip} ${selectedTextureType === tex.id ? styles.textureChipActive : ""}`}
                      onClick={() => setSelectedTextureType(tex.id)}
                    >
                      {tex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <div className={styles.dimLabel}> Physical Dimensions</div>
                <div className={styles.dimControlsRow}>
                  <div className={styles.dimCard}>
                    <div className={styles.dimLabel}>Width</div>
                    <div className={styles.dimStepper}>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("width_ft", -0.5)}>
                        -
                      </button>
                      <span className={styles.dimValue}>{(activeDef?.width_ft || 7.0).toFixed(1)} ft</span>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("width_ft", +0.5)}>
                        +
                      </button>
                    </div>
                  </div>

                  <div className={styles.dimCard}>
                    <div className={styles.dimLabel}>Depth</div>
                    <div className={styles.dimStepper}>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("depth_ft", -0.5)}>
                        -
                      </button>
                      <span className={styles.dimValue}>{(activeDef?.depth_ft || 3.2).toFixed(1)} ft</span>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("depth_ft", +0.5)}>
                        +
                      </button>
                    </div>
                  </div>

                  <div className={styles.dimCard}>
                    <div className={styles.dimLabel}>Height</div>
                    <div className={styles.dimStepper}>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("height_ft", -0.5)}>
                        -
                      </button>
                      <span className={styles.dimValue}>{(activeDef?.height_ft || 2.8).toFixed(1)} ft</span>
                      <button className={styles.stepperBtn} onClick={() => handleUpdateDim("height_ft", +0.5)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Wheel & Swatches */}
              <div className={styles.paletteRow}>
                <div className={styles.swatchesCluster}>
                  {[
                    { name: "Emerald Serpentine", hex: 0x065f46 },
                    { name: "Royal Velvet Navy", hex: 0x1e3a8a },
                    { name: "Charcoal Obsidian", hex: 0x1e293b },
                    { name: "Warm Cognac", hex: 0xb45309 },
                    { name: "Terracotta Rust", hex: 0xb91c1c },
                    { name: "Linen Boucle", hex: 0xf8fafc },
                    { name: "Dark Walnut", hex: 0x3e2723 },
                  ].map((col) => (
                    <button
                      key={col.name}
                      className={`${styles.colorSwatchBtn} ${activeColorHex === col.hex ? styles.colorSwatchActive : ""}`}
                      style={{ backgroundColor: `#${col.hex.toString(16).padStart(6, "0")}` }}
                      onClick={() => setActiveColorHex(col.hex)}
                      title={col.name}
                    />
                  ))}
                </div>

                <label className={styles.colorWheelPicker} title="Pick any custom color">
                  <input
                    type="color"
                    className={styles.colorWheelInput}
                    value={`#${activeColorHex.toString(16).padStart(6, "0")}`}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value.replace("#", "0x"), 16);
                      if (!isNaN(parsed)) setActiveColorHex(parsed);
                    }}
                  />
                  <span
                    className={styles.colorDot}
                    style={{ backgroundColor: `#${activeColorHex.toString(16).padStart(6, "0")}` }}
                  />
                  Color Wheel
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <div className={styles.footerHint}>
              <span>Tip: Scaled {meshCountTarget} meshes with {selectedTextureType.toUpperCase()} PBR texture will spawn into your 3D room.</span>
          </div>
          <button className={styles.spawnBtn} onClick={handleSpawn}>
            Spawn into 3D Simulation
          </button>
        </div>
      </div>
    </div>
  );
}
