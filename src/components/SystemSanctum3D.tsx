import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Habit } from '../types';

interface SystemSanctum3DProps {
  habits: Habit[];
  todayDate: string;
  level: number;
  rankTitle: string;
  totalXp: number;
  onToggleHabit: (habitId: string, dateISO: string) => void;
  onClose: () => void;
}

type LightingPreset = 'azure' | 'monarch' | 'dawn';
type CameraPreset = 'overview' | 'core' | 'top' | 'inspect';

// Module-scope scratch math objects (zero GC allocations inside render loop)
const _vec3 = new THREE.Vector3();
const _color = new THREE.Color();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const rendererStr = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      rendererStr
    );
  } catch {
    return true;
  }
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSanctumFloorTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 1024;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const c = size / 2;
  ctx.fillStyle = '#070b15';
  ctx.fillRect(0, 0, size, size);

  // Subtle concentric slate stone slabs
  const rad = ctx.createRadialGradient(c, c, 40, c, c, c);
  rad.addColorStop(0, '#101b33');
  rad.addColorStop(0.55, '#091020');
  rad.addColorStop(1, '#04070e');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, size, size);

  // Runic rings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  ctx.lineWidth = 3;
  [120, 210, 320, 420].forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
    if (idx % 2 === 1) {
      ctx.save();
      ctx.setLineDash([12, 16]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.beginPath();
      ctx.arc(c, c, r - 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  });

  // Radial architectural lines
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.16)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 90, c + Math.sin(a) * 90);
    ctx.lineTo(c + Math.cos(a) * 460, c + Math.sin(a) * 460);
    ctx.stroke();
  }

  // Fine mineral grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 512, 512);
  bctx.strokeStyle = '#404040';
  bctx.lineWidth = 3;
  [60, 105, 160, 210].forEach((r) => {
    bctx.beginPath();
    bctx.arc(256, 256, r, 0, Math.PI * 2);
    bctx.stroke();
  });

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

function createStoneDetailBump(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 96 + Math.floor(Math.random() * 64);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 3, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const SystemSanctum3D: React.FC<SystemSanctum3DProps> = ({
  habits,
  todayDate,
  level,
  rankTitle,
  totalXp,
  onToggleHabit,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [explodePercent, setExplodePercent] = useState(0);
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('azure');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(
    habits[0]?.id || null
  );

  // Refs synced for the single-mount 60fps Three.js loop
  const explodeTargetRef = useRef(0);
  const lightingPresetRef = useRef<LightingPreset>('azure');
  const habitsRef = useRef(habits);
  const todayDateRef = useRef(todayDate);
  const selectedHabitIdRef = useRef<string | null>(selectedHabitId);
  const onToggleHabitRef = useRef(onToggleHabit);

  const cameraMoveRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(0, 5.2, 12.2),
    targetLook: new THREE.Vector3(0, 2.3, 0),
  });

  const pedestalMetaRef = useRef<
    Map<
      string,
      {
        crystal: THREE.Mesh;
        ring: THREE.Mesh;
        position: THREE.Vector3;
      }
    >
  >(new Map());

  useEffect(() => {
    explodeTargetRef.current = explodePercent / 100;
  }, [explodePercent]);

  useEffect(() => {
    lightingPresetRef.current = lightingPreset;
  }, [lightingPreset]);

  useEffect(() => {
    habitsRef.current = habits;
    todayDateRef.current = todayDate;

    // Update crystal colors immediately without tearing down the WebGL context
    habits.forEach((h) => {
      const meta = pedestalMetaRef.current.get(h.id);
      if (!meta) return;
      const done = h.completedDates.includes(todayDate);
      const isSelected = selectedHabitIdRef.current === h.id;
      const mat = meta.crystal.material as THREE.MeshStandardMaterial;
      if (done) {
        mat.color.setHex(0x38bdf8);
        mat.emissive.setHex(0x0284c7);
        mat.emissiveIntensity = isSelected ? 1.55 : 1.05;
      } else {
        mat.color.setHex(0xf59e0b);
        mat.emissive.setHex(0xb45309);
        mat.emissiveIntensity = isSelected ? 1.15 : 0.48;
      }
    });
  }, [habits, todayDate, selectedHabitId]);

  useEffect(() => {
    selectedHabitIdRef.current = selectedHabitId;
  }, [selectedHabitId]);

  useEffect(() => {
    onToggleHabitRef.current = onToggleHabit;
  }, [onToggleHabit]);

  // Keyboard shortcut H to toggle HUD
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setHudCollapsed((prev) => !prev);
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyCameraPreset = (preset: CameraPreset, targetHabitId?: string | null) => {
    setCameraPreset(preset);
    if (preset === 'overview') {
      cameraMoveRef.current.targetPos.set(0, 5.2, 12.2);
      cameraMoveRef.current.targetLook.set(0, 2.3, 0);
      cameraMoveRef.current.active = true;
    } else if (preset === 'core') {
      cameraMoveRef.current.targetPos.set(0.4, 3.1, 4.9);
      cameraMoveRef.current.targetLook.set(0, 2.8, -0.8);
      cameraMoveRef.current.active = true;
    } else if (preset === 'top') {
      cameraMoveRef.current.targetPos.set(0, 14.5, 4.5);
      cameraMoveRef.current.targetLook.set(0, 0.8, 0.5);
      cameraMoveRef.current.active = true;
    } else if (preset === 'inspect') {
      const id = targetHabitId ?? selectedHabitIdRef.current;
      const meta = id ? pedestalMetaRef.current.get(id) : null;
      if (meta) {
        cameraMoveRef.current.targetPos.set(
          meta.position.x * 1.38,
          2.6,
          meta.position.z + 3.6
        );
        cameraMoveRef.current.targetLook.set(
          meta.position.x,
          1.45,
          meta.position.z
        );
        cameraMoveRef.current.active = true;
      }
    }
  };

  // Single-mount Three.js Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);
    scene.fog = new THREE.FogExp2(0x040711, 0.032);

    // Studio Environment Reflections on ALL devices
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      120
    );
    camera.position.set(0, 5.2, 12.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.055;
    controls.minDistance = 3.2;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.target.set(0, 2.3, 0);
    controls.addEventListener('start', () => {
      cameraMoveRef.current.active = false;
    });

    // Studio 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0b1020, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffe6c7, 2.4);
    keyLight.position.set(8, 14, 9);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 36;
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 13;
    keyLight.shadow.camera.bottom = -13;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-9, 7, -10);
    scene.add(rimLight);

    const portalPointLight = new THREE.PointLight(0x38bdf8, 3.2, 16);
    portalPointLight.position.set(0, 2.9, -0.4);
    scene.add(portalPointLight);

    const disposables: Array<{ dispose: () => void }> = [envRT];
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { albedo: floorAlbedo, bump: floorBump } =
      createSanctumFloorTextures(maxAniso);
    const stoneBump = createStoneDetailBump(maxAniso);
    const contactTex = createRadialShadowTexture();
    disposables.push(floorAlbedo, floorBump, stoneBump, contactTex);

    // Arena Stone Floor (grounded at y = 0)
    const floorGeo = new THREE.CircleGeometry(36, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorAlbedo,
      bumpMap: floorBump,
      bumpScale: 0.04,
      roughness: 0.72,
      metalness: 0.18,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);
    disposables.push(floorGeo, floorMat);

    // Soft radial contact shadow under main Gate (offset y=0.012 with polygonOffset)
    const gateShadowGeo = new THREE.PlaneGeometry(7.2, 5.2);
    gateShadowGeo.rotateX(-Math.PI / 2);
    const gateShadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const gateShadow = new THREE.Mesh(gateShadowGeo, gateShadowMat);
    gateShadow.position.set(0, 0.014, -1.2);
    scene.add(gateShadow);
    disposables.push(gateShadowGeo, gateShadowMat);

    // ========================================================
    // HERO SUBJECT: 10-Part Composite Shadow Gate Monolith Group
    // ========================================================
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, -1.2);
    scene.add(gateGroup);

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x131a2e,
      bumpMap: stoneBump,
      bumpScale: 0.03,
      roughness: 0.82,
      metalness: 0.14,
    });
    const titaniumMat = new THREE.MeshPhysicalMaterial({
      color: 0x64748b,
      metalness: 0.94,
      roughness: 0.18,
      anisotropy: 0.8,
      clearcoat: 0.35,
    });
    const darkAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.32,
    });
    const accentGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.8,
      roughness: 0.25,
      metalness: 0.2,
    });
    const coreCrystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      metalness: 0.05,
      roughness: 0.08,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.55 : 1,
      ior: 1.78,
      thickness: 1.4,
      attenuationColor: new THREE.Color(0x0ea5e9),
      clearcoat: 1.0,
    });
    disposables.push(
      obsidianMat,
      titaniumMat,
      darkAlloyMat,
      accentGlowMat,
      coreCrystalMat
    );

    // Part 1: Stepped Octagonal Basalt Plinth (LatheGeometry, y=0 grounded)
    const plinthPts = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(2.9, 0.0),
      new THREE.Vector2(2.7, 0.24),
      new THREE.Vector2(2.35, 0.28),
      new THREE.Vector2(2.15, 0.52),
      new THREE.Vector2(0.01, 0.52),
    ];
    const plinthGeo = new THREE.LatheGeometry(plinthPts, 8);
    const plinthMesh = new THREE.Mesh(plinthGeo, obsidianMat);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    gateGroup.add(plinthMesh);
    disposables.push(plinthGeo);

    // Part 2: Metallic Step Ring Collar
    const collarGeo = new THREE.TorusGeometry(2.18, 0.055, 12, 8);
    collarGeo.rotateX(Math.PI / 2);
    const collarMesh = new THREE.Mesh(collarGeo, titaniumMat);
    collarMesh.position.y = 0.53;
    gateGroup.add(collarMesh);
    disposables.push(collarGeo);

    // Parts 3 & 4: Twin Chamfered Obsidian Pylons (ExtrudeGeometry)
    const pylonShape = new THREE.Shape();
    pylonShape.moveTo(-0.32, 0);
    pylonShape.lineTo(0.32, 0);
    pylonShape.lineTo(0.22, 3.8);
    pylonShape.lineTo(0, 4.35);
    pylonShape.lineTo(-0.24, 3.8);
    pylonShape.closePath();

    const pylonGeo = new THREE.ExtrudeGeometry(pylonShape, {
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    pylonGeo.translate(0, 0, -0.22);

    const leftPylon = new THREE.Mesh(pylonGeo, obsidianMat);
    leftPylon.position.set(-1.95, 0.48, 0);
    leftPylon.rotation.z = -0.08;
    leftPylon.castShadow = true;
    gateGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(pylonGeo, obsidianMat);
    rightPylon.position.set(1.95, 0.48, 0);
    rightPylon.rotation.z = 0.08;
    rightPylon.castShadow = true;
    gateGroup.add(rightPylon);
    disposables.push(pylonGeo);

    // Parts 5 & 6: Glowing Energy Conduit Strips
    const stripGeo = new THREE.BoxGeometry(0.07, 3.3, 0.08);
    const leftStrip = new THREE.Mesh(stripGeo, accentGlowMat);
    leftStrip.position.set(-1.74, 2.35, 0.25);
    leftStrip.rotation.z = -0.08;
    gateGroup.add(leftStrip);

    const rightStrip = new THREE.Mesh(stripGeo, accentGlowMat);
    rightStrip.position.set(1.74, 2.35, 0.25);
    rightStrip.rotation.z = 0.08;
    gateGroup.add(rightStrip);
    disposables.push(stripGeo);

    // Part 7: Upper Arch Keystone Crown (ExtrudeGeometry)
    const crownShape = new THREE.Shape();
    crownShape.moveTo(-1.15, 0);
    crownShape.lineTo(1.15, 0);
    crownShape.lineTo(0.7, 0.65);
    crownShape.lineTo(-0.7, 0.65);
    crownShape.closePath();
    const crownGeo = new THREE.ExtrudeGeometry(crownShape, {
      depth: 0.48,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    crownGeo.translate(0, 0, -0.24);
    const crownMesh = new THREE.Mesh(crownGeo, darkAlloyMat);
    crownMesh.position.set(0, 4.65, 0);
    crownMesh.castShadow = true;
    gateGroup.add(crownMesh);
    disposables.push(crownGeo);

    // Part 8: Outer Gyroscopic Titanium Ring
    const outerRingGeo = new THREE.TorusGeometry(1.56, 0.085, 16, 48);
    const outerRing = new THREE.Mesh(outerRingGeo, titaniumMat);
    outerRing.position.set(0, 2.85, 0);
    outerRing.castShadow = true;
    gateGroup.add(outerRing);
    disposables.push(outerRingGeo);

    // Part 9: Inner Counter-Rotating Gimbal Arc
    const innerRingGeo = new THREE.TorusGeometry(1.18, 0.055, 14, 40);
    const innerRing = new THREE.Mesh(innerRingGeo, darkAlloyMat);
    innerRing.position.set(0, 2.85, 0);
    gateGroup.add(innerRing);
    disposables.push(innerRingGeo);

    // Part 10: Central Faceted Transmissive Mana Core Crystal
    const coreGeo = new THREE.OctahedronGeometry(0.62, 0);
    coreGeo.scale(0.85, 1.35, 0.85);
    const coreCrystal = new THREE.Mesh(coreGeo, coreCrystalMat);
    coreCrystal.position.set(0, 2.85, 0);
    gateGroup.add(coreCrystal);
    disposables.push(coreGeo);

    // Part 11: Dimensional Portal Wave Disc via onBeforeCompile PBR extension
    const portalUniforms = {
      uTime: { value: 0 },
      uPulseColor: { value: new THREE.Color(0x38bdf8) },
    };
    const portalDiscGeo = new THREE.CircleGeometry(1.42, 40);
    const portalDiscMat = new THREE.MeshStandardMaterial({
      color: 0x09162e,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.42,
      roughness: 0.2,
      metalness: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    portalDiscMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = portalUniforms.uTime;
      shader.uniforms.uPulseColor = portalUniforms.uPulseColor;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec2 vPortalUv;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\nvPortalUv = uv;`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nvarying vec2 vPortalUv;\nuniform float uTime;\nuniform vec3 uPulseColor;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float dist = length(vPortalUv - vec2(0.5)) * 2.0;
           float ringWave = 0.5 + 0.5 * sin(dist * 18.0 - uTime * 3.2);
           float falloff = smoothstep(1.0, 0.15, dist);
           totalEmissiveRadiance += uPulseColor * ringWave * falloff * 0.9;`
        );
    };
    const portalDisc = new THREE.Mesh(portalDiscGeo, portalDiscMat);
    portalDisc.position.set(0, 2.85, -0.05);
    gateGroup.add(portalDisc);
    disposables.push(portalDiscGeo, portalDiscMat);

    // Explode Kinematics Configuration for Gate Sub-parts
    const explodeParts: Array<{
      mesh: THREE.Object3D;
      base: THREE.Vector3;
      offset: THREE.Vector3;
    }> = [
      { mesh: leftPylon, base: new THREE.Vector3(-1.95, 0.48, 0), offset: new THREE.Vector3(-1.35, 0, 0) },
      { mesh: rightPylon, base: new THREE.Vector3(1.95, 0.48, 0), offset: new THREE.Vector3(1.35, 0, 0) },
      { mesh: leftStrip, base: new THREE.Vector3(-1.74, 2.35, 0.25), offset: new THREE.Vector3(-1.55, 0, 0.35) },
      { mesh: rightStrip, base: new THREE.Vector3(1.74, 2.35, 0.25), offset: new THREE.Vector3(1.55, 0, 0.35) },
      { mesh: crownMesh, base: new THREE.Vector3(0, 4.65, 0), offset: new THREE.Vector3(0, 1.35, 0) },
      { mesh: outerRing, base: new THREE.Vector3(0, 2.85, 0), offset: new THREE.Vector3(0, 0.2, 0.85) },
      { mesh: innerRing, base: new THREE.Vector3(0, 2.85, 0), offset: new THREE.Vector3(0, -0.1, -0.85) },
      { mesh: coreCrystal, base: new THREE.Vector3(0, 2.85, 0), offset: new THREE.Vector3(0, 0.45, 0) },
    ];

    // ========================================================
    // HABIT RUNE PEDESTALS (Composite 4-Part Interactive Props)
    // ========================================================
    const pedLathePts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.54, 0),
      new THREE.Vector2(0.42, 0.18),
      new THREE.Vector2(0.28, 0.92),
      new THREE.Vector2(0.46, 1.05),
      new THREE.Vector2(0.01, 1.05),
    ];
    const pedGeo = new THREE.LatheGeometry(pedLathePts, 8);
    const pedCollarGeo = new THREE.TorusGeometry(0.44, 0.035, 10, 24);
    pedCollarGeo.rotateX(Math.PI / 2);

    const crystalShape = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.22;
      if (i === 0) crystalShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else crystalShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    crystalShape.closePath();
    const crystalGeo = new THREE.ExtrudeGeometry(crystalShape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    crystalGeo.center();

    const pedShadowGeo = new THREE.PlaneGeometry(1.55, 1.55);
    pedShadowGeo.rotateX(-Math.PI / 2);
    const pedShadowMat = new THREE.MeshBasicMaterial({
      map: contactTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const hitboxGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.2, 8);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(
      pedGeo,
      pedCollarGeo,
      crystalGeo,
      pedShadowGeo,
      pedShadowMat,
      hitboxGeo,
      hitboxMat
    );

    const clickableHitboxes: THREE.Mesh[] = [];
    const metaMap = new Map<
      string,
      { crystal: THREE.Mesh; ring: THREE.Mesh; position: THREE.Vector3 }
    >();

    const activeHabits = habitsRef.current.slice(0, 7);
    const count = Math.max(1, activeHabits.length);
    activeHabits.forEach((h, idx) => {
      const angle =
        count === 1
          ? Math.PI / 2
          : Math.PI * 0.16 + (idx / (count - 1)) * (Math.PI * 0.68);
      const radius = 5.6;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius - 0.6;

      const pedGroup = new THREE.Group();
      pedGroup.position.set(px, 0, pz);
      scene.add(pedGroup);

      const baseMesh = new THREE.Mesh(pedGeo, obsidianMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      pedGroup.add(baseMesh);

      const ringMesh = new THREE.Mesh(pedCollarGeo, titaniumMat);
      ringMesh.position.y = 1.05;
      pedGroup.add(ringMesh);

      const done = h.completedDates.includes(todayDateRef.current);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: done ? 0x38bdf8 : 0xf59e0b,
        emissive: done ? 0x0284c7 : 0xb45309,
        emissiveIntensity: done ? 1.05 : 0.48,
        roughness: 0.18,
        metalness: 0.35,
      });
      disposables.push(crystalMat);

      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      crystalMesh.position.y = 1.62;
      crystalMesh.castShadow = true;
      pedGroup.add(crystalMesh);

      const shadowDecal = new THREE.Mesh(pedShadowGeo, pedShadowMat);
      shadowDecal.position.y = 0.015;
      pedGroup.add(shadowDecal);

      const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
      hitbox.position.y = 1.1;
      hitbox.layers.set(1);
      hitbox.userData.habitId = h.id;
      pedGroup.add(hitbox);
      clickableHitboxes.push(hitbox);

      metaMap.set(h.id, {
        crystal: crystalMesh,
        ring: ringMesh,
        position: new THREE.Vector3(px, 0, pz),
      });
    });
    pedestalMetaRef.current = metaMap;

    // ========================================================
    // INSTANCED ENVIRONMENT (>20 objects: Outer Pillars & Shards)
    // ========================================================
    const pillarGeo = new THREE.BoxGeometry(0.65, 3.6, 0.65);
    pillarGeo.translate(0, 1.8, 0);
    const pillarInst = new THREE.InstancedMesh(pillarGeo, obsidianMat, 36);
    pillarInst.receiveShadow = true;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 14.5 + (i % 3) * 3.8;
      const scaleH = 0.55 + ((i * 37) % 10) * 0.11;
      _vec3.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      _euler.set(0, -a, 0);
      _quat.setFromEuler(_euler);
      _scale.set(1, scaleH, 1);
      _mat4.compose(_vec3, _quat, _scale);
      pillarInst.setMatrixAt(i, _mat4);
    }
    pillarInst.instanceMatrix.needsUpdate = true;
    pillarInst.computeBoundingSphere();
    scene.add(pillarInst);
    disposables.push(pillarGeo);

    const shardGeo = new THREE.OctahedronGeometry(0.085, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
      roughness: 0.25,
      metalness: 0.2,
    });
    const shardCount = 64;
    const shardInst = new THREE.InstancedMesh(shardGeo, shardMat, shardCount);
    shardInst.frustumCulled = false;
    const shardMeta = Array.from({ length: shardCount }, (_, i) => ({
      angle: (i / shardCount) * Math.PI * 2,
      radius: 2.2 + (i % 7) * 1.15,
      height: 0.6 + (i % 11) * 0.55,
      speed: 0.18 + (i % 5) * 0.06,
      phase: i * 0.7,
    }));
    scene.add(shardInst);
    disposables.push(shardGeo, shardMat);

    // Pre-warm shaders once on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycaster on Layer 1 for instant tap/click selection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (dist > 8) return; // Ignore orbit drags
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableHitboxes, false);
      if (hits.length > 0) {
        const habitId = hits[0].object.userData.habitId as string;
        if (habitId) {
          setSelectedHabitId(habitId);
          selectedHabitIdRef.current = habitId;
          const meta = pedestalMetaRef.current.get(habitId);
          if (meta) {
            setCameraPreset('inspect');
            cameraMoveRef.current.targetPos.set(
              meta.position.x * 1.38,
              2.6,
              meta.position.z + 3.6
            );
            cameraMoveRef.current.targetLook.set(
              meta.position.x,
              1.45,
              meta.position.z
            );
            cameraMoveRef.current.active = true;
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Continuous 60fps loop with software WebGL afterDraw pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let currentExplode = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Update lighting colors based on preset smoothly
      const lp = lightingPresetRef.current;
      const targetAccentHex =
        lp === 'monarch' ? 0xa855f7 : lp === 'dawn' ? 0xf59e0b : 0x38bdf8;
      const targetBgHex =
        lp === 'monarch' ? 0x090514 : lp === 'dawn' ? 0x0d0a08 : 0x040711;

      _color.setHex(targetAccentHex);
      accentGlowMat.emissive.lerp(_color, 0.08);
      portalPointLight.color.setHex(targetAccentHex);
      rimLight.color.setHex(targetAccentHex);
      portalUniforms.uPulseColor.value.setHex(targetAccentHex);
      portalUniforms.uTime.value = elapsed;
      if (scene.background instanceof THREE.Color) {
        scene.background.setHex(targetBgHex);
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setHex(targetBgHex);
      }

      // Smooth Explode View kinematics via THREE.MathUtils.damp
      currentExplode = THREE.MathUtils.damp(
        currentExplode,
        explodeTargetRef.current,
        6.5,
        dt
      );
      for (const p of explodeParts) {
        p.mesh.position.set(
          p.base.x + p.offset.x * currentExplode,
          p.base.y + p.offset.y * currentExplode,
          p.base.z + p.offset.z * currentExplode
        );
      }

      // Rotate Gate rings & core crystal
      outerRing.rotation.z = elapsed * 0.25;
      outerRing.rotation.y = Math.sin(elapsed * 0.4) * 0.14;
      innerRing.rotation.z = -elapsed * 0.48;
      innerRing.rotation.x = Math.cos(elapsed * 0.5) * 0.22;
      coreCrystal.rotation.y = elapsed * 0.7;
      coreCrystal.position.y += Math.sin(elapsed * 2.1) * 0.04;

      // Animate Habit Pedestal crystals
      let idx = 0;
      pedestalMetaRef.current.forEach((meta, id) => {
        const isSel = selectedHabitIdRef.current === id;
        meta.crystal.rotation.y = elapsed * (isSel ? 1.4 : 0.65) + idx;
        meta.crystal.position.y =
          1.62 + Math.sin(elapsed * 2.0 + idx * 0.9) * (isSel ? 0.14 : 0.07);
        const s = THREE.MathUtils.damp(
          meta.crystal.scale.x,
          isSel ? 1.24 : 1.0,
          8,
          dt
        );
        meta.crystal.scale.set(s, s, s);
        idx += 1;
      });

      // Animate Instanced Floating Mana Shards (zero allocations)
      for (let i = 0; i < shardCount; i++) {
        const sm = shardMeta[i];
        const a = sm.angle + elapsed * sm.speed;
        const y = sm.height + Math.sin(elapsed * 1.4 + sm.phase) * 0.35;
        _vec3.set(Math.cos(a) * sm.radius, y, Math.sin(a) * sm.radius - 0.8);
        _euler.set(elapsed * 0.8 + sm.phase, a, 0);
        _quat.setFromEuler(_euler);
        _scale.setScalar(1);
        _mat4.compose(_vec3, _quat, _scale);
        shardInst.setMatrixAt(i, _mat4);
      }
      shardInst.instanceMatrix.needsUpdate = true;

      // Smooth Damped Scripted Camera Transitions
      if (cameraMoveRef.current.active) {
        const alpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(cameraMoveRef.current.targetPos, alpha);
        controls.target.lerp(cameraMoveRef.current.targetLook, alpha);
        if (
          camera.position.distanceTo(cameraMoveRef.current.targetPos) < 0.04 &&
          controls.target.distanceTo(cameraMoveRef.current.targetLook) < 0.04
        ) {
          cameraMoveRef.current.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const selectedHabit = useMemo(
    () => habits.find((h) => h.id === selectedHabitId) || null,
    [habits, selectedHabitId]
  );
  const selectedDone = selectedHabit
    ? selectedHabit.completedDates.includes(todayDate)
    : false;

  return (
    <div className="fixed inset-0 z-50 bg-[#040711] text-slate-100 select-none overflow-hidden">
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
      />

      {/* Minimal Top-Left Header Bar (No side clutter, solid dark rgba, no backdrop-blur) */}
      <div
        style={{
          top: 'max(14px, env(safe-area-inset-top))',
          left: '14px',
          backgroundColor: 'rgba(7, 11, 22, 0.90)',
        }}
        className="fixed z-10 flex items-center gap-3 px-3.5 py-2.5 rounded border border-sky-500/35"
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-sky-300 bg-sky-950/80 hover:bg-sky-600 hover:text-white border border-sky-500/35 rounded transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit 3D
        </button>

        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-sky-400">
            [ 3D SYSTEM SANCTUM · INTERACTIVE ]
          </div>
          <div className="font-display text-sm font-bold tracking-wide text-white truncate tabular-nums">
            Lv.{level} {rankTitle} · {totalXp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* Collapsible Bottom Control Dock (Zero backdrop-filter over WebGL) */}
      <div
        style={{
          bottom: 'max(14px, env(safe-area-inset-bottom))',
        }}
        className="fixed left-1/2 -translate-x-1/2 z-10 w-[min(920px,94vw)] flex flex-col items-center pointer-events-none"
      >
        <button
          type="button"
          onClick={() => setHudCollapsed((c) => !c)}
          style={{ backgroundColor: 'rgba(7, 11, 22, 0.92)' }}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] text-[11px] font-mono uppercase tracking-wider text-sky-300 border border-sky-500/35 rounded hover:bg-sky-950 cursor-pointer"
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show Controls (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Controls (H)
            </>
          )}
        </button>

        {!hudCollapsed && (
          <div
            style={{ backgroundColor: 'rgba(7, 11, 22, 0.92)' }}
            className="pointer-events-auto w-full border border-sky-500/35 rounded-lg p-3 sm:p-3.5 space-y-2.5 shadow-2xl"
          >
            {/* Row 1: Selected Habit Crystal Action + Explode Core Slider */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-sky-500/20">
              {selectedHabit ? (
                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-xs shrink-0 ${
                      selectedDone ? 'bg-sky-400' : 'bg-amber-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate max-w-[230px] sm:max-w-[300px]">
                      {selectedHabit.title}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {selectedHabit.category} · +{selectedHabit.xpReward} XP ·{' '}
                      {selectedHabit.streak}d streak
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleHabit(selectedHabit.id, todayDate)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider font-display rounded transition-colors cursor-pointer ${
                      selectedDone
                        ? 'bg-emerald-700 text-white border border-emerald-400/50'
                        : 'bg-sky-600 hover:bg-sky-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {selectedDone ? 'Cleared Today' : `Complete (+${selectedHabit.xpReward} XP)`}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Tap any floating Rune Crystal around the Gate to inspect or complete a habit.
                </div>
              )}

              {/* Explode Gate Mechanism Slider */}
              <div className="flex items-center gap-2.5 min-w-[190px]">
                <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <label className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
                  Explode {explodePercent}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={explodePercent}
                  onChange={(e) => setExplodePercent(Number(e.target.value))}
                  aria-label="Explode 3D Gate components"
                  className="w-24 accent-sky-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Row 2: Camera Presets + Lighting Atmosphere */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1">
                  Camera:
                </span>
                {(
                  [
                    { id: 'overview', label: 'Overview' },
                    { id: 'core', label: 'Gate Core' },
                    { id: 'inspect', label: 'Selected Rune' },
                    { id: 'top', label: 'Top Map' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => applyCameraPreset(cam.id)}
                    className={`px-2.5 py-1.5 min-h-[34px] text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      cameraPreset === cam.id
                        ? 'bg-sky-600 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-sky-500/50'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setExplodePercent(0);
                    applyCameraPreset('overview');
                  }}
                  title="Reset view"
                  className="px-2 py-1.5 min-h-[34px] text-[11px] text-slate-300 bg-slate-900 border border-slate-700 hover:border-sky-500/50 rounded cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                {(
                  [
                    { id: 'azure', label: 'Azure Gate', swatch: '#38bdf8' },
                    { id: 'monarch', label: 'Monarch', swatch: '#a855f7' },
                    { id: 'dawn', label: 'Gold Dawn', swatch: '#f59e0b' },
                  ] as const
                ).map((lp) => (
                  <button
                    key={lp.id}
                    type="button"
                    onClick={() => setLightingPreset(lp.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      lightingPreset === lp.id
                        ? 'bg-slate-800 text-white border-sky-400'
                        : 'bg-slate-900 text-slate-400 border-slate-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-xs"
                      style={{ backgroundColor: lp.swatch }}
                    />
                    {lp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
