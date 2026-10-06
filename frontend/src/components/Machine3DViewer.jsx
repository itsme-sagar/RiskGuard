import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  RotateCcw,
  Zap,
} from "lucide-react";
import "./Machine3DViewer.css";

// Helper to determine exact subtype from props
function resolveSubtype(machineId = "", machineType = "", explicitSubtype = null) {
  if (explicitSubtype) return explicitSubtype;
  const id = String(machineId).toLowerCase();
  const type = String(machineType).toLowerCase();

  if (id.includes("laptop") || type.includes("laptop") || type.includes("physical")) {
    return "laptop";
  }
  if (id.includes("ind") || type.includes("industrial")) {
    return "industrial-printer";
  }
  if (
    id.includes("fdm") ||
    id.includes("3dp") ||
    type.includes("3d printer") ||
    type.includes("printer")
  ) {
    return "fdm-printer";
  }
  if (id.includes("vmc") || type.includes("vertical") || type.includes("vmc")) {
    return "cnc-vmc";
  }
  if (id.includes("turn") || type.includes("turning")) {
    return "cnc-turning";
  }
  if (id.includes("lathe") || type.includes("lathe")) {
    return "cnc-lathe";
  }
  if (id.includes("mill") || id.includes("cnc") || type.includes("cnc")) {
    return "cnc-milling";
  }
  return "cnc-milling";
}

// Dynamic status and warning evaluation based on live vitals and existing machine thresholds
function getMachineStatusInfo(condition = "NORMAL", vitals = {}, subtype = "", machineType = "") {
  if (condition === "FAILED") {
    return { type: "FAILED", label: "EMERGENCY STOP" };
  }
  if (condition === "CRITICAL") {
    return { type: "CRITICAL", label: "CRITICAL OVERLOAD" };
  }

  const temp = Number(vitals.temperature || 0);
  const workload = Number(vitals.workload || 0);
  const vib = Number(vitals.vibration || 0);

  const isLaptop = subtype === "laptop" || String(machineType).toLowerCase().includes("laptop");
  const isPrinter = subtype.includes("printer") || String(machineType).toLowerCase().includes("printer");
  const isInd = subtype === "industrial-printer";

  // Existing thresholds from machine specs & risk analysis
  let isHighTemp = false;
  if (isLaptop) {
    isHighTemp = temp > 75;
  } else if (isPrinter) {
    isHighTemp = isInd ? temp > 305 : temp > 222;
  } else {
    // CNC Machines
    isHighTemp = temp > 75;
  }

  const isHighLoad = workload > 82;
  const isHighVib = isLaptop ? vib > 1.8 : isPrinter ? vib > 2.8 : vib > 3.8;

  // Normal machine -> no warning badge
  if (condition === "NORMAL" && !isHighTemp && !isHighLoad && !isHighVib) {
    return { type: "NORMAL", label: "NORMAL" };
  }

  // Dynamic warning badge labels based on active sensors
  if (isHighTemp && isHighLoad) {
    return { type: "WARNING", label: "LOAD / THERMAL WARNING" };
  }
  if (isHighLoad) {
    return { type: "WARNING", label: "LOAD WARNING" };
  }
  if (isHighTemp) {
    return { type: "WARNING", label: "THERMAL WARNING" };
  }
  if (isHighVib) {
    return { type: "WARNING", label: "VIBRATION WARNING" };
  }

  if (condition === "WARNING") {
    return { type: "WARNING", label: "SYSTEM WARNING" };
  }

  return { type: "NORMAL", label: "NORMAL" };
}

function Machine3DViewer({
  machineType = "CNC Machine",
  machineId = "CNC-MILL-01",
  subtype = null,
  vitals = {},
  condition = "NORMAL",
  isLive = true,
  isAcConnected = true,
}) {
  const containerRef = useRef(null);
  const [heatmapMode, setHeatmapMode] = useState(false);

  // References to animated 3D parts
  const animPartsRef = useRef({
    rotatingGroup: null,
    tableGroup: null,
    carriageGroup: null,
    spindleGroup: null,
    atcGroup: null,
    printHeadGroup: null,
    bedGroup: null,
    fanBlades: null,
    thermalLight: null,
    statusBeacon: null,
    statusLight: null,
    andonTower: null,
    screenCanvas: null,
    screenTexture: null,
    chargerLed: null,
    chargerLight: null,
    coolantStream: null,
  });

  const resolvedSubtype = resolveSubtype(machineId, machineType, subtype);

  const stateRef = useRef({
    condition,
    vitals,
    machineType,
    machineId,
    subtype: resolvedSubtype,
    heatmapMode,
    isLive,
    isAcConnected,
  });

  useEffect(() => {
    stateRef.current = {
      condition,
      vitals,
      machineType,
      machineId,
      subtype: resolvedSubtype,
      heatmapMode,
      isLive,
      isAcConnected,
    };
  }, [condition, vitals, machineType, machineId, resolvedSubtype, heatmapMode, isLive, isAcConnected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 420;

    // 1. Natural Industrial Workshop Scene & Fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a212d); // Warm neutral industrial workshop bay
    scene.fog = new THREE.FogExp2(0x1a212d, 0.024);

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    let defaultCamPos = new THREE.Vector3(4.8, 3.8, 5.6);
    let defaultCamTarget = new THREE.Vector3(0, 1.4, 0);

    if (resolvedSubtype === "laptop") {
      defaultCamPos = new THREE.Vector3(2.8, 2.4, 3.2);
      defaultCamTarget = new THREE.Vector3(0, 0.65, 0);
    } else if (resolvedSubtype === "cnc-lathe") {
      defaultCamPos = new THREE.Vector3(4.6, 3.0, 4.8);
      defaultCamTarget = new THREE.Vector3(0, 1.2, 0);
    } else if (resolvedSubtype === "cnc-turning") {
      defaultCamPos = new THREE.Vector3(4.5, 3.2, 4.7);
      defaultCamTarget = new THREE.Vector3(0, 1.2, 0);
    } else if (resolvedSubtype === "industrial-printer") {
      defaultCamPos = new THREE.Vector3(4.8, 3.8, 5.5);
      defaultCamTarget = new THREE.Vector3(0, 1.5, 0);
    }

    camera.position.copy(defaultCamPos);

    // 3. Renderer with realistic contact shadows
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.minDistance = 2.0;
    controls.maxDistance = 15.0;
    controls.target.copy(defaultCamTarget);

    // 4. Industrial Shop Floor & Mounting Pad
    const gridHelper = new THREE.GridHelper(16, 32, 0x334155, 0x222b38);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Cast Concrete / Machine Foundation Slab
    const pedestalGeo = new THREE.CylinderGeometry(3.6, 3.85, 0.16, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x242c38,
      roughness: 0.85,
      metalness: 0.12,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.08;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // Subtle Factory Safety Amber Clearance Boundary (#C7A84B)
    const safetyLineGeo = new THREE.RingGeometry(3.52, 3.58, 48);
    const safetyLineMat = new THREE.MeshBasicMaterial({
      color: 0xc7a84b, // Factory Safety Amber
      side: THREE.DoubleSide,
    });
    const safetyLine = new THREE.Mesh(safetyLineGeo, safetyLineMat);
    safetyLine.rotation.x = -Math.PI / 2;
    safetyLine.position.y = 0.165;
    scene.add(safetyLine);

    // 5. Natural Factory Warm Lighting Rig (No neon/purple/cyberpunk)
    // Diffuse Ambient Factory Fill
    const ambientLight = new THREE.AmbientLight(0xdce5ef, 0.72);
    scene.add(ambientLight);

    // Overhead High-Bay Industrial Luminaire (Warm 4200K Halogen/Metal-Halide)
    const highBayLight = new THREE.DirectionalLight(0xfff6eb, 1.55);
    highBayLight.position.set(5.5, 9.5, 7.0);
    highBayLight.castShadow = true;
    highBayLight.shadow.mapSize.width = 1024;
    highBayLight.shadow.mapSize.height = 1024;
    highBayLight.shadow.bias = -0.0008;
    scene.add(highBayLight);

    // Secondary Neutral Diffuse Fill from Opposite Side
    const fillLight = new THREE.DirectionalLight(0xaab8c8, 0.55);
    fillLight.position.set(-5.5, 4.5, -4);
    scene.add(fillLight);

    // 6. Realistic Industrial Material Library
    const castIronMat = new THREE.MeshStandardMaterial({
      color: 0x2d333b, // Textured cast iron casting
      roughness: 0.65,
      metalness: 0.45,
    });
    const groundSteelMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af, // Ground tool steel
      roughness: 0.22,
      metalness: 0.92,
    });
    const polishedChromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Polished chrome / stainless steel
      roughness: 0.08,
      metalness: 0.98,
    });
    const blackenedSteelMat = new THREE.MeshStandardMaterial({
      color: 0x181c22, // Blackened oxide steel
      roughness: 0.35,
      metalness: 0.85,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xbfa15f,
      roughness: 0.28,
      metalness: 0.8,
    });
    const factoryEnamelGrey = new THREE.MeshStandardMaterial({
      color: 0x374151, // Haas/DMG industrial dark slate grey
      roughness: 0.45,
      metalness: 0.25,
    });
    const factoryOffWhite = new THREE.MeshStandardMaterial({
      color: 0xd1d5db, // Industrial off-white powder-coat panels
      roughness: 0.4,
      metalness: 0.15,
    });
    const safetyAmberMat = new THREE.MeshStandardMaterial({
      color: 0xc7a84b, // Subtle safety marking accent (#C7A84B)
      roughness: 0.38,
      metalness: 0.15,
    });
    const eStopRedMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c, // Industrial E-stop safety red
      roughness: 0.35,
      metalness: 0.1,
    });
    const temperedGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8d6e5,
      transparent: true,
      opacity: 0.36,
      roughness: 0.08,
      metalness: 0.1,
      transmission: 0.86,
      ior: 1.52,
    });
    const machinedAlumMat = new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      roughness: 0.25,
      metalness: 0.88,
    });
    const rubberMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.9,
      metalness: 0.05,
    });

    const machineGroup = new THREE.Group();
    scene.add(machineGroup);

    // Reset animated parts
    animPartsRef.current = {};

    // Helper: Add heavy machine leveling feet under corners
    const addLevelingFeet = (group, width, depth, yPos) => {
      const footGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.06, 16);
      const studGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 12);
      const hw = width / 2 - 0.2;
      const hd = depth / 2 - 0.2;
      const corners = [
        [-hw, -hd],
        [hw, -hd],
        [-hw, hd],
        [hw, hd],
      ];
      corners.forEach(([x, z]) => {
        const pad = new THREE.Mesh(footGeo, blackenedSteelMat);
        pad.position.set(x, yPos, z);
        pad.receiveShadow = true;
        const stud = new THREE.Mesh(studGeo, groundSteelMat);
        stud.position.set(x, yPos + 0.06, z);
        group.add(pad, stud);
      });
    };

    // Helper: Create authentic 3-tier Andon Signal Tower (Red, Amber, Green)
    const createAndonTower = (x, y, z) => {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(x, y, z);

      // Chrome Riser Pole
      const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12);
      const pole = new THREE.Mesh(poleGeo, polishedChromeMat);
      pole.position.y = 0.225;
      towerGroup.add(pole);

      // Base Mounting Collar
      const baseGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 16);
      const baseCollar = new THREE.Mesh(baseGeo, blackenedSteelMat);
      baseCollar.position.y = 0.48;
      towerGroup.add(baseCollar);

      // 3 Physical Cylindrical Lens Segments
      const lensGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.09, 16);

      // Bottom Lens: Green
      const greenMat = new THREE.MeshStandardMaterial({
        color: 0x14532d,
        emissive: 0x16a34a,
        emissiveIntensity: 0.1,
        roughness: 0.3,
      });
      const greenLens = new THREE.Mesh(lensGeo, greenMat);
      greenLens.position.y = 0.55;

      // Middle Lens: Amber
      const amberMat = new THREE.MeshStandardMaterial({
        color: 0x78350f,
        emissive: 0xc7a84b,
        emissiveIntensity: 0.1,
        roughness: 0.3,
      });
      const amberLens = new THREE.Mesh(lensGeo, amberMat);
      amberLens.position.y = 0.65;

      // Top Lens: Red
      const redMat = new THREE.MeshStandardMaterial({
        color: 0x450a0a,
        emissive: 0xdc2626,
        emissiveIntensity: 0.1,
        roughness: 0.3,
      });
      const redLens = new THREE.Mesh(lensGeo, redMat);
      redLens.position.y = 0.75;

      // Weatherproof Cap
      const capGeo = new THREE.ConeGeometry(0.06, 0.05, 16);
      const cap = new THREE.Mesh(capGeo, blackenedSteelMat);
      cap.position.y = 0.82;

      towerGroup.add(greenLens, amberLens, redLens, cap);
      machineGroup.add(towerGroup);

      // Associated soft point light
      const towerLight = new THREE.PointLight(0x16a34a, 0.8, 3.5);
      towerLight.position.set(x, y + 0.65, z + 0.15);
      scene.add(towerLight);

      return {
        towerGroup,
        greenLens,
        amberLens,
        redLens,
        towerLight,
      };
    };

    // Helper: Create authentic Articulated CNC Control Pendant (Operator Station)
    const createControlPendant = (x, y, z) => {
      const pendantGroup = new THREE.Group();
      pendantGroup.position.set(x, y, z);

      // Articulated tubular steel swing arm
      const arm1Geo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 12);
      arm1Geo.rotateZ(Math.PI / 2);
      const arm1 = new THREE.Mesh(arm1Geo, groundSteelMat);
      arm1.position.set(0.27, 0, 0);

      const elbowGeo = new THREE.SphereGeometry(0.055, 12, 12);
      const elbow = new THREE.Mesh(elbowGeo, blackenedSteelMat);
      elbow.position.set(0.55, 0, 0);

      const arm2Geo = new THREE.CylinderGeometry(0.035, 0.035, 0.45, 12);
      arm2Geo.rotateX(Math.PI / 2);
      const arm2 = new THREE.Mesh(arm2Geo, groundSteelMat);
      arm2.position.set(0.55, 0, 0.22);

      pendantGroup.add(arm1, elbow, arm2);

      // Operator Console Box (angled toward operator)
      const consoleBox = new THREE.Group();
      consoleBox.position.set(0.55, -0.15, 0.45);
      consoleBox.rotation.y = -0.32;

      const housingGeo = new THREE.BoxGeometry(0.72, 0.86, 0.18);
      const housing = new THREE.Mesh(housingGeo, factoryEnamelGrey);
      consoleBox.add(housing);

      // CNC Screen Canvas
      const screenFaceGeo = new THREE.PlaneGeometry(0.54, 0.38);
      const sCanvas = document.createElement("canvas");
      sCanvas.width = 256;
      sCanvas.height = 180;
      const sCtx = sCanvas.getContext("2d");
      if (sCtx) {
        sCtx.fillStyle = "#0f172a";
        sCtx.fillRect(0, 0, 256, 180);
        sCtx.fillStyle = "#38bdf8";
        sCtx.font = "bold 13px ui-monospace, monospace";
        sCtx.fillText("CNC G-CODE CONTROLLER", 12, 22);
        sCtx.fillStyle = "#94a3b8";
        sCtx.font = "11px ui-monospace, monospace";
        sCtx.fillText("X: +0142.500 mm", 14, 52);
        sCtx.fillText("Y: -0068.250 mm", 14, 76);
        sCtx.fillText("Z: +0012.000 mm", 14, 100);
        sCtx.fillStyle = "#c7a84b";
        sCtx.fillText("FEED: 850 mm/min", 14, 132);
        sCtx.fillStyle = "#22c55e";
        sCtx.fillText("STATUS: CYCLE RUN", 14, 156);
      }
      const sTex = new THREE.CanvasTexture(sCanvas);
      const sMat = new THREE.MeshBasicMaterial({ map: sTex });
      const screenMesh = new THREE.Mesh(screenFaceGeo, sMat);
      screenMesh.position.set(0, 0.16, 0.095);
      consoleBox.add(screenMesh);

      // Membrane Keypad Area
      const keypadGeo = new THREE.PlaneGeometry(0.54, 0.18);
      const keypadMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.7,
      });
      const keypad = new THREE.Mesh(keypadGeo, keypadMat);
      keypad.position.set(0, -0.15, 0.095);
      consoleBox.add(keypad);

      // Cycle Start Button (Green)
      const btnGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.03, 12);
      btnGeo.rotateX(Math.PI / 2);
      const startBtnMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.3 });
      const startBtn = new THREE.Mesh(btnGeo, startBtnMat);
      startBtn.position.set(-0.16, -0.3, 0.1);
      consoleBox.add(startBtn);

      // Feed Hold Button (Amber)
      const holdBtnMat = new THREE.MeshStandardMaterial({ color: 0xc7a84b, roughness: 0.3 });
      const holdBtn = new THREE.Mesh(btnGeo, holdBtnMat);
      holdBtn.position.set(-0.06, -0.3, 0.1);
      consoleBox.add(holdBtn);

      // Emergency Stop (E-Stop): Large Red Mushroom Button with Yellow Safety Collar (#C7A84B)
      const collarGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.025, 20);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, safetyAmberMat);
      collar.position.set(0.14, -0.3, 0.1);

      const eStopGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.04, 20);
      eStopGeo.rotateX(Math.PI / 2);
      const eStop = new THREE.Mesh(eStopGeo, eStopRedMat);
      eStop.position.set(0.14, -0.3, 0.125);

      consoleBox.add(collar, eStop);
      pendantGroup.add(consoleBox);
      machineGroup.add(pendantGroup);

      return pendantGroup;
    };

    // =========================================================================
    // BUILD 1: CNC MILLING MACHINE (cnc-milling)
    // Realistic Haas / Mazak style Industrial CNC Mill
    // =========================================================================
    if (resolvedSubtype === "cnc-milling") {
      // 1. Heavy Cast-Iron Foundation Base with Coolant Tray
      const baseGeo = new THREE.BoxGeometry(3.6, 0.65, 2.8);
      const baseMesh = new THREE.Mesh(baseGeo, castIronMat);
      baseMesh.position.set(0, 0.485, 0);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      machineGroup.add(baseMesh);

      // 4 Leveling vibration isolation feet under corners
      addLevelingFeet(machineGroup, 3.6, 2.8, 0.19);

      // Coolant & Chip Return Tray
      const trayGeo = new THREE.BoxGeometry(3.68, 0.1, 2.88);
      const trayMesh = new THREE.Mesh(trayGeo, factoryEnamelGrey);
      trayMesh.position.set(0, 0.83, 0);
      machineGroup.add(trayMesh);

      // 2. Rear Structural Z-Axis Column
      const columnGeo = new THREE.BoxGeometry(1.4, 2.6, 1.2);
      const columnMesh = new THREE.Mesh(columnGeo, factoryEnamelGrey);
      columnMesh.position.set(0, 2.15, -0.75);
      columnMesh.castShadow = true;
      machineGroup.add(columnMesh);

      // Accordion rubber way-cover bellows
      const bellowGeo = new THREE.BoxGeometry(0.95, 2.1, 0.12);
      const bellows = new THREE.Mesh(bellowGeo, rubberMat);
      bellows.position.set(0, 2.15, -0.14);
      machineGroup.add(bellows);

      // Dual Z-axis ground steel guideway rails
      const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2, 16);
      const leftRail = new THREE.Mesh(railGeo, groundSteelMat);
      leftRail.position.set(-0.4, 2.15, -0.13);
      const rightRail = new THREE.Mesh(railGeo, groundSteelMat);
      rightRail.position.set(0.4, 2.15, -0.13);
      machineGroup.add(leftRail, rightRail);

      // 3. Two-Tone Sheet Metal Industrial Enclosure Cabinet
      // Left side enclosure wall in off-white powder-coat
      const leftWallGeo = new THREE.BoxGeometry(0.08, 2.45, 2.7);
      const leftWall = new THREE.Mesh(leftWallGeo, factoryOffWhite);
      leftWall.position.set(-1.76, 2.08, 0);
      leftWall.castShadow = true;
      machineGroup.add(leftWall);

      // Right side enclosure wall in off-white powder-coat
      const rightWall = new THREE.Mesh(leftWallGeo, factoryOffWhite);
      rightWall.position.set(1.76, 2.08, 0);
      rightWall.castShadow = true;
      machineGroup.add(rightWall);

      // Rear sheet metal panel
      const rearWallGeo = new THREE.BoxGeometry(3.6, 2.45, 0.08);
      const rearWall = new THREE.Mesh(rearWallGeo, factoryOffWhite);
      rearWall.position.set(0, 2.08, -1.36);
      machineGroup.add(rearWall);

      // Enclosure Roof & Mist Exhaust Filtration Cowl
      const roofGeo = new THREE.BoxGeometry(3.62, 0.12, 2.82);
      const roof = new THREE.Mesh(roofGeo, factoryEnamelGrey);
      roof.position.set(0, 3.34, 0);
      machineGroup.add(roof);

      const cowlGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.35, 20);
      const cowl = new THREE.Mesh(cowlGeo, factoryEnamelGrey);
      cowl.position.set(-0.8, 3.56, -0.5);
      machineGroup.add(cowl);

      // 4. Front Dual Sliding Safety Doors with Tempered Glass & Handles
      // Upper door header rail with Safety Amber Caution stripe (#C7A84B)
      const headerGeo = new THREE.BoxGeometry(3.62, 0.14, 0.1);
      const header = new THREE.Mesh(headerGeo, factoryEnamelGrey);
      header.position.set(0, 3.22, 1.4);
      machineGroup.add(header);

      const cautionStripeGeo = new THREE.BoxGeometry(3.64, 0.04, 0.11);
      const cautionStripe = new THREE.Mesh(cautionStripeGeo, safetyAmberMat);
      cautionStripe.position.set(0, 3.22, 1.41);
      machineGroup.add(cautionStripe);

      // Lower door guide track
      const lowerTrackGeo = new THREE.BoxGeometry(3.62, 0.12, 0.1);
      const lowerTrack = new THREE.Mesh(lowerTrackGeo, factoryEnamelGrey);
      lowerTrack.position.set(0, 0.94, 1.4);
      machineGroup.add(lowerTrack);

      // Left Sliding Door Frame & Glass
      const doorWidth = 1.35;
      const doorHeight = 2.14;
      const leftDoorFrameGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.05);
      const leftDoorFrame = new THREE.Mesh(leftDoorFrameGeo, factoryEnamelGrey);
      leftDoorFrame.position.set(-0.72, 2.08, 1.42);
      machineGroup.add(leftDoorFrame);

      const leftGlassGeo = new THREE.BoxGeometry(1.1, 1.75, 0.04);
      const leftGlass = new THREE.Mesh(leftGlassGeo, temperedGlassMat);
      leftGlass.position.set(-0.72, 2.12, 1.43);
      machineGroup.add(leftGlass);

      // Left Door Vertical Stainless Grab Handle
      const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.9, 12);
      const leftHandle = new THREE.Mesh(handleGeo, polishedChromeMat);
      leftHandle.position.set(-0.12, 2.12, 1.48);
      machineGroup.add(leftHandle);

      // Right Sliding Door Frame & Glass
      const rightDoorFrame = new THREE.Mesh(leftDoorFrameGeo, factoryEnamelGrey);
      rightDoorFrame.position.set(0.72, 2.08, 1.38);
      machineGroup.add(rightDoorFrame);

      const rightGlass = new THREE.Mesh(leftGlassGeo, temperedGlassMat);
      rightGlass.position.set(0.72, 2.12, 1.39);
      machineGroup.add(rightGlass);

      const rightHandle = new THREE.Mesh(handleGeo, polishedChromeMat);
      rightHandle.position.set(0.12, 2.12, 1.44);
      machineGroup.add(rightHandle);

      // Warm Interior Chamber Work Light (Illuminates Workspace through Glass)
      const chamberWorkLight = new THREE.PointLight(0xfff8ee, 1.35, 4.2);
      chamberWorkLight.position.set(0, 3.1, 0.25);
      scene.add(chamberWorkLight);

      // 5. Precision Ground T-Slot Table Assembly
      const tableGroup = new THREE.Group();
      tableGroup.position.set(0, 0.96, 0.25);

      const saddleGeo = new THREE.BoxGeometry(2.2, 0.16, 1.6);
      const saddleMesh = new THREE.Mesh(saddleGeo, castIronMat);
      saddleMesh.castShadow = true;
      tableGroup.add(saddleMesh);

      const tableTopGeo = new THREE.BoxGeometry(2.0, 0.12, 1.4);
      const tableTopMesh = new THREE.Mesh(tableTopGeo, groundSteelMat);
      tableTopMesh.position.y = 0.14;
      tableTopMesh.castShadow = true;
      tableGroup.add(tableTopMesh);

      // Longitudinal T-Slots
      for (let s = -0.4; s <= 0.4; s += 0.26) {
        const slotGeo = new THREE.BoxGeometry(1.98, 0.02, 0.04);
        const slotMesh = new THREE.Mesh(slotGeo, blackenedSteelMat);
        slotMesh.position.set(0, 0.201, s);
        tableGroup.add(slotMesh);
      }

      // Heavy Kurt Precision Milling Vise
      const viseBodyGeo = new THREE.BoxGeometry(0.85, 0.22, 0.65);
      const viseMesh = new THREE.Mesh(viseBodyGeo, factoryEnamelGrey);
      viseMesh.position.set(0, 0.31, 0);
      tableGroup.add(viseMesh);

      // Hardened vise jaws
      const jawGeo = new THREE.BoxGeometry(0.85, 0.08, 0.06);
      const fixedJaw = new THREE.Mesh(jawGeo, groundSteelMat);
      fixedJaw.position.set(0, 0.36, -0.22);
      const movingJaw = new THREE.Mesh(jawGeo, groundSteelMat);
      movingJaw.position.set(0, 0.36, 0.12);
      tableGroup.add(fixedJaw, movingJaw);

      // Vise Handle with Safety Amber Trim (#C7A84B)
      const viseHandleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12);
      const viseHandle = new THREE.Mesh(viseHandleGeo, safetyAmberMat);
      viseHandle.position.set(0, 0.31, 0.42);
      tableGroup.add(viseHandle);

      // Machined 6061 Aluminum Billet Workpiece
      const workpieceGeo = new THREE.BoxGeometry(0.55, 0.26, 0.28);
      const workpiece = new THREE.Mesh(workpieceGeo, machinedAlumMat);
      workpiece.position.set(0, 0.45, -0.05);
      workpiece.castShadow = true;
      tableGroup.add(workpiece);

      machineGroup.add(tableGroup);
      animPartsRef.current.tableGroup = tableGroup;

      // 6. Z-Axis Spindle Head Assembly
      const spindleGroup = new THREE.Group();
      spindleGroup.position.set(0, 2.38, 0.25);

      const mountGeo = new THREE.BoxGeometry(0.92, 1.15, 0.72);
      const mountMesh = new THREE.Mesh(mountGeo, factoryEnamelGrey);
      mountMesh.castShadow = true;
      spindleGroup.add(mountMesh);

      // Spindle Drive AC Servo Motor
      const motorGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.85, 24);
      const motorMesh = new THREE.Mesh(motorGeo, castIronMat);
      motorMesh.position.set(0, 0.05, 0.26);
      motorMesh.castShadow = true;
      spindleGroup.add(motorMesh);

      // Rotating CAT-40 Tool Holder & Collet Chuck
      const rotatingGroup = new THREE.Group();
      rotatingGroup.position.set(0, -0.42, 0.26);

      const chuckGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.26, 20);
      const chuckMesh = new THREE.Mesh(chuckGeo, groundSteelMat);
      chuckMesh.castShadow = true;
      rotatingGroup.add(chuckMesh);

      // Solid Carbide 4-Flute End Mill
      const toolGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.36, 12);
      const toolBit = new THREE.Mesh(toolGeo, polishedChromeMat);
      toolBit.position.set(0, -0.26, 0);
      toolBit.castShadow = true;
      rotatingGroup.add(toolBit);
      spindleGroup.add(rotatingGroup);

      // Dual Articulated Loc-Line Coolant Hoses (Navy/Black rubber)
      const hoseGeo = new THREE.TorusGeometry(0.22, 0.024, 8, 20, Math.PI);
      const leftHose = new THREE.Mesh(hoseGeo, rubberMat);
      leftHose.rotation.z = Math.PI / 4;
      leftHose.position.set(0.26, -0.22, 0.26);
      const rightHose = new THREE.Mesh(hoseGeo, rubberMat);
      rightHose.rotation.z = -Math.PI / 4;
      rightHose.position.set(-0.26, -0.22, 0.26);
      spindleGroup.add(leftHose, rightHose);

      // Coolant Stream Line
      const streamGeo = new THREE.CylinderGeometry(0.015, 0.02, 0.32, 8);
      const streamMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.55,
      });
      const coolantStream = new THREE.Mesh(streamGeo, streamMat);
      coolantStream.position.set(0.1, -0.46, 0.26);
      coolantStream.rotation.z = -0.25;
      spindleGroup.add(coolantStream);

      // Natural Warm Cutting Friction Glow Light
      const cutterLight = new THREE.PointLight(0xffa500, 0, 1.8);
      cutterLight.position.set(0, -0.5, 0.26);
      spindleGroup.add(cutterLight);

      machineGroup.add(spindleGroup);
      animPartsRef.current.spindleGroup = spindleGroup;
      animPartsRef.current.rotatingGroup = rotatingGroup;
      animPartsRef.current.thermalLight = cutterLight;
      animPartsRef.current.coolantStream = coolantStream;

      // 7. Right-Side Articulated CNC Control Pendant
      createControlPendant(1.8, 2.2, 0.8);

      // 8. Physical 3-Tier Andon Signal Tower (Roof Mounted)
      const andon = createAndonTower(1.55, 3.4, -0.3);
      animPartsRef.current.andonTower = andon;
      animPartsRef.current.statusLight = andon.towerLight;
    }

    // =========================================================================
    // BUILD 2: CNC LATHE MACHINE (cnc-lathe)
    // Realistic Horizontal Industrial CNC Turning Lathe
    // =========================================================================
    else if (resolvedSubtype === "cnc-lathe") {
      // 1. Heavy Slant/Horizontal Bed with Ground Ways
      const bedGeo = new THREE.BoxGeometry(4.2, 0.68, 1.7);
      const bedMesh = new THREE.Mesh(bedGeo, castIronMat);
      bedMesh.position.set(0, 0.5, 0);
      bedMesh.castShadow = true;
      bedMesh.receiveShadow = true;
      machineGroup.add(bedMesh);

      // 4 Leveling feet
      addLevelingFeet(machineGroup, 4.2, 1.7, 0.2);

      // Ground hardened bed guideways
      const wayGeo = new THREE.BoxGeometry(3.8, 0.06, 0.14);
      const way1 = new THREE.Mesh(wayGeo, groundSteelMat);
      way1.position.set(0, 0.86, -0.32);
      const way2 = new THREE.Mesh(wayGeo, groundSteelMat);
      way2.position.set(0, 0.86, 0.32);
      machineGroup.add(way1, way2);

      // 2. Left Headstock Housing in Factory Slate Grey
      const headstockGeo = new THREE.BoxGeometry(1.3, 1.45, 1.55);
      const headstockMesh = new THREE.Mesh(headstockGeo, factoryEnamelGrey);
      headstockMesh.position.set(-1.45, 1.42, 0);
      headstockMesh.castShadow = true;
      machineGroup.add(headstockMesh);

      // Safety Amber Warning Placard (#C7A84B)
      const placardGeo = new THREE.BoxGeometry(0.32, 0.16, 0.02);
      const placard = new THREE.Mesh(placardGeo, safetyAmberMat);
      placard.position.set(-1.45, 1.88, 0.78);
      machineGroup.add(placard);

      // Main Horizontal Rotating 3-Jaw Power Chuck Assembly
      const chuckGroup = new THREE.Group();
      chuckGroup.position.set(-0.72, 1.42, 0);

      const chuckBodyGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32);
      chuckBodyGeo.rotateZ(Math.PI / 2);
      const chuckBody = new THREE.Mesh(chuckBodyGeo, groundSteelMat);
      chuckBody.castShadow = true;
      chuckGroup.add(chuckBody);

      // Safety Amber Rim on Chuck Guard Edge (#C7A84B)
      const chuckRimGeo = new THREE.TorusGeometry(0.51, 0.016, 8, 32);
      chuckRimGeo.rotateY(Math.PI / 2);
      const chuckRim = new THREE.Mesh(chuckRimGeo, safetyAmberMat);
      chuckRim.position.set(0.15, 0, 0);
      chuckGroup.add(chuckRim);

      // 3 Radial Hardened Steel Master Jaws
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const jawGeo = new THREE.BoxGeometry(0.18, 0.16, 0.1);
        const jaw = new THREE.Mesh(jawGeo, blackenedSteelMat);
        jaw.position.set(0.12, Math.cos(angle) * 0.3, Math.sin(angle) * 0.3);
        jaw.rotation.x = -angle;
        chuckGroup.add(jaw);
      }

      // Stepped Turned 4140 Steel Shaft Workpiece
      const shaftGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.2, 24);
      shaftGeo.rotateZ(Math.PI / 2);
      const shaftMesh = new THREE.Mesh(shaftGeo, machinedAlumMat);
      shaftMesh.position.set(1.1, 0, 0);
      shaftMesh.castShadow = true;
      chuckGroup.add(shaftMesh);

      machineGroup.add(chuckGroup);
      animPartsRef.current.rotatingGroup = chuckGroup;

      // 3. Sliding Tailstock with Conical Live Center
      const tailstockGroup = new THREE.Group();
      tailstockGroup.position.set(1.65, 1.36, 0);

      const tailBodyGeo = new THREE.BoxGeometry(0.85, 1.05, 0.95);
      const tailBody = new THREE.Mesh(tailBodyGeo, factoryEnamelGrey);
      tailstockGroup.add(tailBody);

      const quillGeo = new THREE.ConeGeometry(0.1, 0.3, 20);
      quillGeo.rotateZ(-Math.PI / 2);
      const quill = new THREE.Mesh(quillGeo, polishedChromeMat);
      quill.position.set(-0.55, 0.06, 0);
      tailstockGroup.add(quill);
      machineGroup.add(tailstockGroup);

      // 4. Longitudinal Carriage & 4-Way Toolpost
      const carriageGroup = new THREE.Group();
      carriageGroup.position.set(0.2, 1.15, 0.58);

      const saddleGeo = new THREE.BoxGeometry(0.95, 0.24, 0.9);
      const saddleMesh = new THREE.Mesh(saddleGeo, castIronMat);
      carriageGroup.add(saddleMesh);

      const toolpostGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);
      const toolpostMesh = new THREE.Mesh(toolpostGeo, blackenedSteelMat);
      toolpostMesh.position.set(0, 0.28, -0.16);
      carriageGroup.add(toolpostMesh);

      // Tungsten Carbide Turning Insert in Gold/Brass (#C7A84B)
      const toolholderGeo = new THREE.BoxGeometry(0.52, 0.08, 0.08);
      const toolholder = new THREE.Mesh(toolholderGeo, blackenedSteelMat);
      toolholder.position.set(0, 0.28, -0.38);
      carriageGroup.add(toolholder);

      const insertGeo = new THREE.ConeGeometry(0.045, 0.07, 3);
      insertGeo.rotateX(Math.PI / 2);
      const insert = new THREE.Mesh(insertGeo, brassMat);
      insert.position.set(0, 0.28, -0.6);
      carriageGroup.add(insert);

      // Friction Contact Thermal Glow Light
      const contactLight = new THREE.PointLight(0xffa500, 0, 1.6);
      contactLight.position.set(0, 0.28, -0.6);
      carriageGroup.add(contactLight);

      machineGroup.add(carriageGroup);
      animPartsRef.current.carriageGroup = carriageGroup;
      animPartsRef.current.thermalLight = contactLight;

      // 5. Sliding Chip Splash-Guard Door with Tempered Glass & Stainless Handle
      const guardDoorGeo = new THREE.BoxGeometry(1.8, 1.4, 0.05);
      const guardDoor = new THREE.Mesh(guardDoorGeo, factoryEnamelGrey);
      guardDoor.position.set(0.3, 1.85, 0.9);
      machineGroup.add(guardDoor);

      const guardGlassGeo = new THREE.BoxGeometry(1.5, 1.0, 0.04);
      const guardGlass = new THREE.Mesh(guardGlassGeo, temperedGlassMat);
      guardGlass.position.set(0.3, 1.88, 0.91);
      machineGroup.add(guardGlass);

      const guardHandleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.65, 12);
      const guardHandle = new THREE.Mesh(guardHandleGeo, polishedChromeMat);
      guardHandle.position.set(-0.5, 1.88, 0.96);
      machineGroup.add(guardHandle);

      // Hazard Stripe on Guard Rail (#C7A84B)
      const railStripeGeo = new THREE.BoxGeometry(2.4, 0.035, 0.06);
      const railStripe = new THREE.Mesh(railStripeGeo, safetyAmberMat);
      railStripe.position.set(0.3, 1.12, 0.9);
      machineGroup.add(railStripe);

      // 6. Articulated Control Console & 3-Tier Andon Tower
      createControlPendant(1.9, 1.8, 0.6);
      const andon = createAndonTower(-1.45, 2.2, -0.2);
      animPartsRef.current.andonTower = andon;
      animPartsRef.current.statusLight = andon.towerLight;
    }

    // =========================================================================
    // BUILD 3: CNC VERTICAL MACHINING CENTER (cnc-vmc)
    // Full Enclosure with 16-Pocket Rotary Tool Changer (ATC)
    // =========================================================================
    else if (resolvedSubtype === "cnc-vmc") {
      // 1. Foundation Base with Leveling Feet
      const baseGeo = new THREE.BoxGeometry(3.8, 0.68, 2.9);
      const baseMesh = new THREE.Mesh(baseGeo, castIronMat);
      baseMesh.position.set(0, 0.5, 0);
      baseMesh.castShadow = true;
      machineGroup.add(baseMesh);

      addLevelingFeet(machineGroup, 3.8, 2.9, 0.2);

      // 2. Two-Tone Industrial Enclosure Cabinet (Anthracite & Off-White)
      const cabinetGeo = new THREE.BoxGeometry(3.8, 3.2, 2.85);
      const cabinetMesh = new THREE.Mesh(cabinetGeo, factoryEnamelGrey);
      cabinetMesh.position.set(0, 2.05, -0.15);
      cabinetMesh.castShadow = true;
      machineGroup.add(cabinetMesh);

      // Front Face Panel in Off-White Powder Coat
      const frontPanelGeo = new THREE.BoxGeometry(3.72, 3.12, 0.08);
      const frontPanel = new THREE.Mesh(frontPanelGeo, factoryOffWhite);
      frontPanel.position.set(0, 2.05, 1.25);
      machineGroup.add(frontPanel);

      // Dual Sliding Safety Glass Doors
      const leftDoorGeo = new THREE.BoxGeometry(1.3, 1.9, 0.05);
      const leftDoor = new THREE.Mesh(leftDoorGeo, factoryEnamelGrey);
      leftDoor.position.set(-0.68, 2.05, 1.3);
      machineGroup.add(leftDoor);

      const leftGlassGeo = new THREE.BoxGeometry(1.05, 1.55, 0.04);
      const leftGlass = new THREE.Mesh(leftGlassGeo, temperedGlassMat);
      leftGlass.position.set(-0.68, 2.08, 1.31);
      machineGroup.add(leftGlass);

      const handleGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.85, 12);
      const leftHandle = new THREE.Mesh(handleGeo, polishedChromeMat);
      leftHandle.position.set(-0.1, 2.08, 1.36);
      machineGroup.add(leftHandle);

      const rightDoor = new THREE.Mesh(leftDoorGeo, factoryEnamelGrey);
      rightDoor.position.set(0.68, 2.05, 1.28);
      machineGroup.add(rightDoor);

      const rightGlass = new THREE.Mesh(leftGlassGeo, temperedGlassMat);
      rightGlass.position.set(0.68, 2.08, 1.29);
      machineGroup.add(rightGlass);

      const rightHandle = new THREE.Mesh(handleGeo, polishedChromeMat);
      rightHandle.position.set(0.1, 2.08, 1.34);
      machineGroup.add(rightHandle);

      // Subtle Safety Caution Frame Strip (#C7A84B)
      const cautionFrameGeo = new THREE.BoxGeometry(2.8, 0.05, 0.08);
      const cautionFrame = new THREE.Mesh(cautionFrameGeo, safetyAmberMat);
      cautionFrame.position.set(0, 3.05, 1.31);
      machineGroup.add(cautionFrame);

      // Chamber Work Light (Clean 4500K LED Luminaire)
      const chamberLight = new THREE.PointLight(0xfff8ee, 1.4, 4.2);
      chamberLight.position.set(0, 3.0, 0.2);
      scene.add(chamberLight);

      // 3. Rotary Automatic Tool Changer (ATC) 16-Pocket Carousel
      const atcGroup = new THREE.Group();
      atcGroup.position.set(-1.15, 2.3, -0.15);

      const atcDiscGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.06, 24);
      const atcDisc = new THREE.Mesh(atcDiscGeo, factoryEnamelGrey);
      atcGroup.add(atcDisc);

      for (let i = 0; i < 16; i++) {
        const theta = (i * Math.PI * 2) / 16;
        const pocketToolGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10);
        const pocketTool = new THREE.Mesh(pocketToolGeo, groundSteelMat);
        pocketTool.position.set(Math.cos(theta) * 0.6, -0.12, Math.sin(theta) * 0.6);
        atcGroup.add(pocketTool);
      }
      machineGroup.add(atcGroup);
      animPartsRef.current.atcGroup = atcGroup;

      // 4. Central Heavy Spindle Quill & CAT-40 Chuck
      const spindleGroup = new THREE.Group();
      spindleGroup.position.set(0, 2.45, 0.25);

      const quillGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.15, 24);
      const quill = new THREE.Mesh(quillGeo, castIronMat);
      spindleGroup.add(quill);

      const rotatingChuck = new THREE.Group();
      rotatingChuck.position.set(0, -0.58, 0);

      const colletGeo = new THREE.CylinderGeometry(0.18, 0.13, 0.25, 20);
      const collet = new THREE.Mesh(colletGeo, groundSteelMat);
      rotatingChuck.add(collet);

      const bitGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.4, 12);
      const bit = new THREE.Mesh(bitGeo, polishedChromeMat);
      bit.position.set(0, -0.28, 0);
      rotatingChuck.add(bit);
      spindleGroup.add(rotatingChuck);

      // Cutting Point Light
      const cutterLight = new THREE.PointLight(0xffa500, 0, 1.8);
      cutterLight.position.set(0, -0.48, 0);
      spindleGroup.add(cutterLight);

      machineGroup.add(spindleGroup);
      animPartsRef.current.spindleGroup = spindleGroup;
      animPartsRef.current.rotatingGroup = rotatingChuck;
      animPartsRef.current.thermalLight = cutterLight;

      // 5. Sliding Heavy T-Slot Table
      const tableGroup = new THREE.Group();
      tableGroup.position.set(0, 1.02, 0.25);

      const tableGeo = new THREE.BoxGeometry(1.9, 0.16, 1.35);
      const tableMesh = new THREE.Mesh(tableGeo, groundSteelMat);
      tableGroup.add(tableMesh);

      const viseGeo = new THREE.BoxGeometry(0.75, 0.22, 0.55);
      const viseMesh = new THREE.Mesh(viseGeo, factoryEnamelGrey);
      viseMesh.position.set(0, 0.18, 0);
      tableGroup.add(viseMesh);

      const wpGeo = new THREE.BoxGeometry(0.5, 0.24, 0.3);
      const wpMesh = new THREE.Mesh(wpGeo, machinedAlumMat);
      wpMesh.position.set(0, 0.32, 0);
      tableGroup.add(wpMesh);

      machineGroup.add(tableGroup);
      animPartsRef.current.tableGroup = tableGroup;

      // 6. Control Pendant & Andon Tower
      createControlPendant(1.95, 2.3, 0.85);
      const andon = createAndonTower(1.65, 3.65, -0.3);
      animPartsRef.current.andonTower = andon;
      animPartsRef.current.statusLight = andon.towerLight;
    }

    // =========================================================================
    // BUILD 4: CNC TURNING CENTER (cnc-turning)
    // Rigid 45-degree Slant Bed with 12-Station Tool Turret
    // =========================================================================
    else if (resolvedSubtype === "cnc-turning") {
      // 1. 45-degree Slant-Bed Rigid Casting
      const bedBaseGeo = new THREE.BoxGeometry(4.0, 0.72, 2.3);
      const bedBase = new THREE.Mesh(bedBaseGeo, castIronMat);
      bedBase.position.set(0, 0.52, 0);
      machineGroup.add(bedBase);

      addLevelingFeet(machineGroup, 4.0, 2.3, 0.2);

      const slantWedgeGeo = new THREE.BoxGeometry(3.6, 1.25, 1.45);
      slantWedgeGeo.rotateX(Math.PI / 4);
      const slantWedge = new THREE.Mesh(slantWedgeGeo, factoryEnamelGrey);
      slantWedge.position.set(0, 1.2, -0.25);
      slantWedge.castShadow = true;
      machineGroup.add(slantWedge);

      // 2. Hydraulic Power Chuck on Left
      const chuckGroup = new THREE.Group();
      chuckGroup.position.set(-1.25, 1.42, 0);

      const chuckGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.32, 32);
      chuckGeo.rotateZ(Math.PI / 2);
      const chuckMesh = new THREE.Mesh(chuckGeo, groundSteelMat);
      chuckGroup.add(chuckMesh);

      // Amber Safety Guard Rim on Chuck (#C7A84B)
      const guardRimGeo = new THREE.TorusGeometry(0.56, 0.018, 8, 32);
      guardRimGeo.rotateY(Math.PI / 2);
      const guardRim = new THREE.Mesh(guardRimGeo, safetyAmberMat);
      guardRim.position.set(0.16, 0, 0);
      chuckGroup.add(guardRim);

      // 3 Stepped Hydraulic Jaws
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        const jawGeo = new THREE.BoxGeometry(0.18, 0.18, 0.14);
        const jaw = new THREE.Mesh(jawGeo, blackenedSteelMat);
        jaw.position.set(0.12, Math.cos(ang) * 0.32, Math.sin(ang) * 0.32);
        chuckGroup.add(jaw);
      }

      // Flanged Turned Steel Workpiece
      const partGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.6, 24);
      partGeo.rotateZ(Math.PI / 2);
      const partMesh = new THREE.Mesh(partGeo, machinedAlumMat);
      partMesh.position.set(0.85, 0, 0);
      chuckGroup.add(partMesh);

      machineGroup.add(chuckGroup);
      animPartsRef.current.rotatingGroup = chuckGroup;

      // 3. 12-Station Octagonal Live Tooling Turret
      const turretSlideGroup = new THREE.Group();
      turretSlideGroup.position.set(0.4, 1.75, -0.3);

      const turretDiscGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.24, 8);
      turretDiscGeo.rotateZ(Math.PI / 2);
      const turretDisc = new THREE.Mesh(turretDiscGeo, factoryEnamelGrey);
      turretSlideGroup.add(turretDisc);

      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI * 2) / 8;
        const toolGeo = new THREE.BoxGeometry(0.14, 0.1, 0.1);
        const toolMesh = new THREE.Mesh(toolGeo, blackenedSteelMat);
        toolMesh.position.set(0, Math.cos(ang) * 0.5, Math.sin(ang) * 0.5);
        turretSlideGroup.add(toolMesh);
      }

      // Active cutting tool pointing to workpiece
      const activeToolGeo = new THREE.BoxGeometry(0.12, 0.28, 0.08);
      const activeTool = new THREE.Mesh(activeToolGeo, blackenedSteelMat);
      activeTool.position.set(0, -0.55, 0.28);
      turretSlideGroup.add(activeTool);

      const insertGeo = new THREE.ConeGeometry(0.04, 0.07, 4);
      insertGeo.rotateX(Math.PI);
      const insert = new THREE.Mesh(insertGeo, brassMat);
      insert.position.set(0, -0.72, 0.28);
      turretSlideGroup.add(insert);

      // Contact point light
      const contactLight = new THREE.PointLight(0xffa500, 0, 1.6);
      contactLight.position.set(0, -0.75, 0.28);
      turretSlideGroup.add(contactLight);

      machineGroup.add(turretSlideGroup);
      animPartsRef.current.carriageGroup = turretSlideGroup;
      animPartsRef.current.thermalLight = contactLight;

      // 4. Sliding Safety Door with Window & Stainless Handle
      const doorGeo = new THREE.BoxGeometry(1.9, 1.5, 0.05);
      const doorMesh = new THREE.Mesh(doorGeo, factoryEnamelGrey);
      doorMesh.position.set(0.4, 1.9, 1.0);
      machineGroup.add(doorMesh);

      const glassGeo = new THREE.BoxGeometry(1.6, 1.1, 0.04);
      const glassMesh = new THREE.Mesh(glassGeo, temperedGlassMat);
      glassMesh.position.set(0.4, 1.92, 1.01);
      machineGroup.add(glassMesh);

      const sHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.7, 12),
        polishedChromeMat
      );
      sHandle.position.set(-0.45, 1.92, 1.06);
      machineGroup.add(sHandle);

      // 5. Control Pendant & Andon Tower
      createControlPendant(1.95, 1.9, 0.7);
      const andon = createAndonTower(-1.3, 2.35, -0.3);
      animPartsRef.current.andonTower = andon;
      animPartsRef.current.statusLight = andon.towerLight;
    }

    // =========================================================================
    // BUILD 5: FDM 3D PRINTER (fdm-printer)
    // =========================================================================
    else if (resolvedSubtype === "fdm-printer") {
      // 1. Black Anodized Extrusion Base Frame
      const baseGeo = new THREE.BoxGeometry(2.6, 0.45, 2.6);
      const baseMesh = new THREE.Mesh(baseGeo, factoryEnamelGrey);
      baseMesh.position.set(0, 0.38, 0);
      baseMesh.castShadow = true;
      machineGroup.add(baseMesh);

      // Dual Black Anodized V-Slot Z Uprights & Crossbar
      const gantryPillarGeo = new THREE.BoxGeometry(0.16, 2.8, 0.16);
      const leftPillar = new THREE.Mesh(gantryPillarGeo, factoryEnamelGrey);
      leftPillar.position.set(-1.05, 1.8, 0);
      const rightPillar = new THREE.Mesh(gantryPillarGeo, factoryEnamelGrey);
      rightPillar.position.set(1.05, 1.8, 0);

      const topBarGeo = new THREE.BoxGeometry(2.26, 0.16, 0.16);
      const topBar = new THREE.Mesh(topBarGeo, factoryEnamelGrey);
      topBar.position.set(0, 3.2, 0);
      machineGroup.add(leftPillar, rightPillar, topBar);

      // Threaded Brass Z Lead Screws
      const screwGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.7, 12);
      const leftScrew = new THREE.Mesh(screwGeo, brassMat);
      leftScrew.position.set(-0.9, 1.8, -0.1);
      const rightScrew = new THREE.Mesh(screwGeo, brassMat);
      rightScrew.position.set(0.9, 1.8, -0.1);
      machineGroup.add(leftScrew, rightScrew);

      // Top Filament Spool
      const spoolArmGeo = new THREE.BoxGeometry(0.08, 0.45, 0.5);
      const spoolArm = new THREE.Mesh(spoolArmGeo, factoryEnamelGrey);
      spoolArm.position.set(-0.6, 3.5, 0);
      const spoolGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 24);
      spoolGeo.rotateZ(Math.PI / 2);
      const spoolMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
      });
      const spoolMesh = new THREE.Mesh(spoolGeo, spoolMat);
      spoolMesh.position.set(-0.6, 3.75, 0.25);
      machineGroup.add(spoolArm, spoolMesh);

      // 2. Heated Bed with Golden/Amber PEI Spring Steel Sheet (#C7A84B)
      const bedGroup = new THREE.Group();
      bedGroup.position.set(0, 0.65, 0);

      const bedSubGeo = new THREE.BoxGeometry(1.7, 0.06, 1.7);
      const bedSub = new THREE.Mesh(bedSubGeo, factoryEnamelGrey);
      bedGroup.add(bedSub);

      const peiGeo = new THREE.BoxGeometry(1.6, 0.04, 1.6);
      const peiMesh = new THREE.Mesh(peiGeo, safetyAmberMat); // Realistic PEI golden/amber build plate
      peiMesh.position.y = 0.04;
      bedGroup.add(peiMesh);

      // 3D Printed Industrial Part on Bed
      const printObjectGeo = new THREE.CylinderGeometry(0.3, 0.38, 0.45, 8);
      const printObjectMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.35,
        metalness: 0.1,
      });
      const printObject = new THREE.Mesh(printObjectGeo, printObjectMat);
      printObject.position.set(0, 0.28, 0);
      bedGroup.add(printObject);

      machineGroup.add(bedGroup);
      animPartsRef.current.bedGroup = bedGroup;

      // 3. Direct-Drive Print Head Carriage
      const xGantryGroup = new THREE.Group();
      xGantryGroup.position.set(0, 1.65, 0);

      const xRailGeo = new THREE.BoxGeometry(2.1, 0.14, 0.14);
      const xRailMesh = new THREE.Mesh(xRailGeo, factoryEnamelGrey);
      xGantryGroup.add(xRailMesh);

      const printHeadGroup = new THREE.Group();
      printHeadGroup.position.set(0, 0, 0.16);

      const extruderBodyGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35);
      const extruderBody = new THREE.Mesh(extruderBodyGeo, factoryEnamelGrey);
      printHeadGroup.add(extruderBody);

      // Fan Vent
      const fanVentGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16);
      fanVentGeo.rotateX(Math.PI / 2);
      const fanVent = new THREE.Mesh(fanVentGeo, rubberMat);
      fanVent.position.set(0, 0.05, 0.18);
      printHeadGroup.add(fanVent);

      const fanBladesGeo = new THREE.BoxGeometry(0.16, 0.02, 0.02);
      const fanBladesMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
      const fanBlades = new THREE.Mesh(fanBladesGeo, fanBladesMat);
      fanBlades.position.set(0, 0.05, 0.19);
      printHeadGroup.add(fanBlades);

      // Brass Nozzle
      const nozzleGeo = new THREE.ConeGeometry(0.06, 0.14, 16);
      nozzleGeo.rotateX(Math.PI);
      const nozzleTip = new THREE.Mesh(nozzleGeo, brassMat);
      nozzleTip.position.set(0, -0.34, 0);
      printHeadGroup.add(nozzleTip);

      // Warm Nozzle Thermal Glow Light (incandescent warmth)
      const nozzleLight = new THREE.PointLight(0xffa500, 0.6, 1.2);
      nozzleLight.position.set(0, -0.36, 0);
      printHeadGroup.add(nozzleLight);

      xGantryGroup.add(printHeadGroup);
      machineGroup.add(xGantryGroup);

      animPartsRef.current.xGantryGroup = xGantryGroup;
      animPartsRef.current.printHeadGroup = printHeadGroup;
      animPartsRef.current.thermalLight = nozzleLight;
      animPartsRef.current.fanBlades = fanBlades;

      // Status Bar
      const lightBarGeo = new THREE.BoxGeometry(1.6, 0.06, 0.06);
      const lightBarMat = new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        emissive: 0x16a34a,
        emissiveIntensity: 0.8,
      });
      const statusBeacon = new THREE.Mesh(lightBarGeo, lightBarMat);
      statusBeacon.position.set(0, 3.12, 0.1);
      machineGroup.add(statusBeacon);

      const statusLight = new THREE.PointLight(0x16a34a, 0.9, 3.0);
      statusLight.position.set(0, 3.12, 0.3);
      scene.add(statusLight);

      animPartsRef.current.statusBeacon = statusBeacon;
      animPartsRef.current.statusLight = statusLight;
    }

    // =========================================================================
    // BUILD 6: INDUSTRIAL 3D PRINTER (industrial-printer)
    // =========================================================================
    else if (resolvedSubtype === "industrial-printer") {
      // 1. Welded Steel Insulated Cabinet in Two-Tone Industrial Grey & Off-White
      const cabinetGeo = new THREE.BoxGeometry(3.4, 3.6, 2.6);
      const cabinetMesh = new THREE.Mesh(cabinetGeo, factoryEnamelGrey);
      cabinetMesh.position.set(0, 1.88, 0);
      cabinetMesh.castShadow = true;
      machineGroup.add(cabinetMesh);

      addLevelingFeet(machineGroup, 3.4, 2.6, 0.19);

      // Off-White Door Surround
      const doorSurroundGeo = new THREE.BoxGeometry(2.6, 2.4, 0.04);
      const doorSurround = new THREE.Mesh(doorSurroundGeo, factoryOffWhite);
      doorSurround.position.set(0, 2.1, 1.31);
      machineGroup.add(doorSurround);

      // Tempered Glass Door Panel
      const doorWindowGeo = new THREE.BoxGeometry(2.2, 2.0, 0.06);
      const doorWindow = new THREE.Mesh(doorWindowGeo, temperedGlassMat);
      doorWindow.position.set(0, 2.1, 1.33);
      machineGroup.add(doorWindow);

      // Safety Amber Door Latch Handle (#C7A84B)
      const latchGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08);
      const latch = new THREE.Mesh(latchGeo, safetyAmberMat);
      latch.position.set(1.15, 2.1, 1.37);
      machineGroup.add(latch);

      // Heated Chamber Thermal Radiator (Warm 2800K glow)
      const chamberHeaterLight = new THREE.PointLight(0xffa500, 1.2, 3.6);
      chamberHeaterLight.position.set(0, 2.5, 0.2);
      scene.add(chamberHeaterLight);

      // 2. CoreXY Precision Gantry with Dual Extruders
      const gantryGroup = new THREE.Group();
      gantryGroup.position.set(0, 2.7, 0.2);

      const gantryFrameGeo = new THREE.BoxGeometry(2.6, 0.12, 1.8);
      const gantryFrame = new THREE.Mesh(gantryFrameGeo, groundSteelMat);
      gantryGroup.add(gantryFrame);

      const toolheadGroup = new THREE.Group();
      toolheadGroup.position.set(0, -0.15, 0);

      const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.35);
      const head1 = new THREE.Mesh(headGeo, factoryEnamelGrey);
      head1.position.set(-0.25, 0, 0);
      const head2 = new THREE.Mesh(headGeo, factoryEnamelGrey);
      head2.position.set(0.25, 0, 0);
      toolheadGroup.add(head1, head2);

      const nGeo = new THREE.ConeGeometry(0.05, 0.12, 16);
      nGeo.rotateX(Math.PI);
      const n1 = new THREE.Mesh(nGeo, brassMat);
      n1.position.set(-0.25, -0.22, 0);
      const n2 = new THREE.Mesh(nGeo, brassMat);
      n2.position.set(0.25, -0.22, 0);
      toolheadGroup.add(n1, n2);

      gantryGroup.add(toolheadGroup);
      machineGroup.add(gantryGroup);

      animPartsRef.current.printHeadGroup = toolheadGroup;
      animPartsRef.current.thermalLight = chamberHeaterLight;

      // 3. Ceramic Vacuum Build Platform
      const bedGroup = new THREE.Group();
      bedGroup.position.set(0, 1.15, 0.2);

      const bedGeo = new THREE.BoxGeometry(2.0, 0.1, 1.4);
      const bedMesh = new THREE.Mesh(bedGeo, groundSteelMat);
      bedGroup.add(bedMesh);

      // 3D Printed Turbine Part
      const turbineGeo = new THREE.CylinderGeometry(0.45, 0.55, 0.5, 16);
      const turbineMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.7,
        roughness: 0.3,
      });
      const turbine = new THREE.Mesh(turbineGeo, turbineMat);
      turbine.position.set(0, 0.3, 0);
      bedGroup.add(turbine);

      machineGroup.add(bedGroup);
      animPartsRef.current.bedGroup = bedGroup;

      // Lower Material Filament Canisters Bay
      const bayGeo = new THREE.BoxGeometry(2.6, 0.5, 0.1);
      const bayMesh = new THREE.Mesh(bayGeo, factoryEnamelGrey);
      bayMesh.position.set(0, 0.45, 1.31);
      machineGroup.add(bayMesh);

      // Status Tower
      const andon = createAndonTower(1.45, 3.75, 0.8);
      animPartsRef.current.andonTower = andon;
      animPartsRef.current.statusLight = andon.towerLight;
    }

    // =========================================================================
    // BUILD 7: LAPTOP DIGITAL TWIN (laptop) - Physical Input Driver
    // =========================================================================
    else if (resolvedSubtype === "laptop") {
      // 1. Milled Space-Grey Anodized Aluminum Unibody Base
      const baseGeo = new THREE.BoxGeometry(3.0, 0.12, 2.0);
      const laptopAlumMat = new THREE.MeshStandardMaterial({
        color: 0x475569, // Space grey anodized aluminum
        metalness: 0.88,
        roughness: 0.28,
      });
      const baseMesh = new THREE.Mesh(baseGeo, laptopAlumMat);
      baseMesh.position.set(0, 0.22, 0);
      baseMesh.castShadow = true;
      machineGroup.add(baseMesh);

      // Matte Black Keyboard Recess & Chiclet Keys
      const kbTrayGeo = new THREE.BoxGeometry(2.6, 0.02, 1.0);
      const kbTrayMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.65,
      });
      const kbTray = new THREE.Mesh(kbTrayGeo, kbTrayMat);
      kbTray.position.set(0, 0.285, -0.22);
      machineGroup.add(kbTray);

      // Glass Trackpad
      const padGeo = new THREE.BoxGeometry(1.0, 0.015, 0.65);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.2,
      });
      const trackpad = new THREE.Mesh(padGeo, padMat);
      trackpad.position.set(0, 0.285, 0.55);
      machineGroup.add(trackpad);

      // 2. Open Display Lid Angled at ~115 Degrees
      const lidGroup = new THREE.Group();
      lidGroup.position.set(0, 0.28, -0.98);

      const lidGeo = new THREE.BoxGeometry(3.0, 1.95, 0.08);
      const lidMesh = new THREE.Mesh(lidGeo, laptopAlumMat);
      lidMesh.position.set(0, 0.95, 0);
      lidMesh.castShadow = true;
      lidGroup.add(lidMesh);

      // 3. Dynamic Live Telemetry Canvas Screen Texture
      const screenCanvas = document.createElement("canvas");
      screenCanvas.width = 512;
      screenCanvas.height = 320;
      const screenTexture = new THREE.CanvasTexture(screenCanvas);
      screenTexture.generateMipmaps = true;
      screenTexture.minFilter = THREE.LinearFilter;

      const screenGeo = new THREE.PlaneGeometry(2.8, 1.75);
      const screenMat = new THREE.MeshBasicMaterial({
        map: screenTexture,
      });
      const screenMesh = new THREE.Mesh(screenGeo, screenMat);
      screenMesh.position.set(0, 0.95, 0.045);
      lidGroup.add(screenMesh);

      lidGroup.rotation.x = 0.42;
      machineGroup.add(lidGroup);

      // Subtle natural screen illumination onto keyboard
      const screenGlowLight = new THREE.PointLight(0xe2e8f0, 0.5, 2.0);
      screenGlowLight.position.set(0, 1.1, -0.4);
      scene.add(screenGlowLight);

      // 4. Side USB-C Power Connector & Charging Status LED
      const portGroup = new THREE.Group();
      portGroup.position.set(-1.52, 0.22, -0.5);

      const plugGeo = new THREE.BoxGeometry(0.18, 0.08, 0.12);
      const plugMesh = new THREE.Mesh(plugGeo, groundSteelMat);
      portGroup.add(plugMesh);

      const cableGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 12);
      cableGeo.rotateZ(Math.PI / 2);
      const cableMesh = new THREE.Mesh(cableGeo, rubberMat);
      cableMesh.position.set(-0.4, 0, 0);
      portGroup.add(cableMesh);

      // LED Indicator: Natural Green (AC Connected) or Safety Amber (On Battery)
      const ledGeo = new THREE.SphereGeometry(0.035, 12, 12);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x16a34a,
        emissive: 0x16a34a,
        emissiveIntensity: 1.2,
      });
      const chargerLed = new THREE.Mesh(ledGeo, ledMat);
      chargerLed.position.set(0, 0.05, 0);
      portGroup.add(chargerLed);

      const chargerLight = new THREE.PointLight(0x16a34a, 0.8, 1.0);
      chargerLight.position.set(0, 0.08, 0);
      portGroup.add(chargerLight);

      machineGroup.add(portGroup);

      animPartsRef.current.screenCanvas = screenCanvas;
      animPartsRef.current.screenTexture = screenTexture;
      animPartsRef.current.chargerLed = chargerLed;
      animPartsRef.current.chargerLight = chargerLight;
    }

    // =========================================================================
    // DYNAMIC ANIMATION & OSCILLOSCOPE LOOP
    // =========================================================================
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;
      const curVitals = currentState.vitals || {};
      const curCondition = currentState.condition || "NORMAL";
      const isFailed = curCondition === "FAILED";
      const curAcConnected = currentState.isAcConnected;

      // Status Beacon & Andon Light Tower Control based on dynamic status
      const statusInfo = getMachineStatusInfo(
        curCondition,
        curVitals,
        resolvedSubtype,
        currentState.machineType
      );
      const effectiveType = statusInfo.type;

      let statusColor = 0x16a34a; // Industrial Green
      let beaconIntensity = 0.8;

      if (effectiveType === "WARNING") {
        statusColor = 0xc7a84b; // Safety Amber
        beaconIntensity = 1.0;
      } else if (effectiveType === "CRITICAL") {
        statusColor = 0xdc2626; // Industrial Red
        beaconIntensity = 1.2;
      } else if (effectiveType === "FAILED") {
        statusColor = 0x7f1d1d; // Dark fault red pulse
        beaconIntensity = Math.floor(elapsedTime * 3) % 2 === 0 ? 1.4 : 0.1;
      }

      // 3-Tier Andon Stack Tower Update
      const andon = animPartsRef.current.andonTower;
      if (andon) {
        const isPulseOn = Math.floor(elapsedTime * 3) % 2 === 0;

        if (effectiveType === "NORMAL") {
          andon.greenLens.material.emissiveIntensity = 1.3;
          andon.greenLens.material.color.setHex(0x16a34a);
          andon.amberLens.material.emissiveIntensity = 0.05;
          andon.amberLens.material.color.setHex(0x78350f);
          andon.redLens.material.emissiveIntensity = 0.05;
          andon.redLens.material.color.setHex(0x450a0a);
          andon.towerLight.color.setHex(0x16a34a);
          andon.towerLight.intensity = 0.8;
        } else if (effectiveType === "WARNING") {
          andon.greenLens.material.emissiveIntensity = 0.05;
          andon.greenLens.material.color.setHex(0x14532d);
          andon.amberLens.material.emissiveIntensity = 1.4;
          andon.amberLens.material.color.setHex(0xc7a84b);
          andon.redLens.material.emissiveIntensity = 0.05;
          andon.redLens.material.color.setHex(0x450a0a);
          andon.towerLight.color.setHex(0xc7a84b);
          andon.towerLight.intensity = 1.0;
        } else if (effectiveType === "CRITICAL") {
          andon.greenLens.material.emissiveIntensity = 0.05;
          andon.greenLens.material.color.setHex(0x14532d);
          andon.amberLens.material.emissiveIntensity = 0.05;
          andon.amberLens.material.color.setHex(0x78350f);
          andon.redLens.material.emissiveIntensity = 1.5;
          andon.redLens.material.color.setHex(0xdc2626);
          andon.towerLight.color.setHex(0xdc2626);
          andon.towerLight.intensity = 1.2;
        } else if (effectiveType === "FAILED") {
          andon.greenLens.material.emissiveIntensity = 0.05;
          andon.greenLens.material.color.setHex(0x14532d);
          andon.amberLens.material.emissiveIntensity = 0.05;
          andon.amberLens.material.color.setHex(0x78350f);
          andon.redLens.material.emissiveIntensity = isPulseOn ? 1.6 : 0.1;
          andon.redLens.material.color.setHex(0xef4444);
          andon.towerLight.color.setHex(0xef4444);
          andon.towerLight.intensity = isPulseOn ? 1.4 : 0.1;
        }
      }

      if (animPartsRef.current.statusBeacon) {
        animPartsRef.current.statusBeacon.material.color.setHex(statusColor);
        animPartsRef.current.statusBeacon.material.emissive.setHex(statusColor);
        animPartsRef.current.statusBeacon.material.emissiveIntensity = beaconIntensity;
      }
      if (animPartsRef.current.statusLight && !andon) {
        animPartsRef.current.statusLight.color.setHex(statusColor);
        animPartsRef.current.statusLight.intensity = beaconIntensity;
      }

      // CNC Mechanics Animation
      if (
        resolvedSubtype === "cnc-milling" ||
        resolvedSubtype === "cnc-lathe" ||
        resolvedSubtype === "cnc-vmc" ||
        resolvedSubtype === "cnc-turning"
      ) {
        const rpm = isFailed ? 0 : Number(curVitals.rpm || 3200);
        const temp = Number(curVitals.temperature || 70);
        const vibration = Number(curVitals.vibration || 1.4);

        if (animPartsRef.current.rotatingGroup && rpm > 0) {
          const rotSpeed = (rpm / 3000) * 0.32;
          if (resolvedSubtype === "cnc-lathe" || resolvedSubtype === "cnc-turning") {
            animPartsRef.current.rotatingGroup.rotation.x += rotSpeed;
          } else {
            animPartsRef.current.rotatingGroup.rotation.y += rotSpeed;
          }
        }

        if (animPartsRef.current.tableGroup && !isFailed) {
          const feedSpeed = (Number(curVitals.workload || 50) / 100) * 0.7;
          animPartsRef.current.tableGroup.position.x =
            Math.sin(elapsedTime * feedSpeed * 1.4) * 0.32;
          animPartsRef.current.tableGroup.position.z =
            0.25 + Math.cos(elapsedTime * feedSpeed * 0.8) * 0.14;
        }

        if (animPartsRef.current.carriageGroup && !isFailed) {
          const feedSpeed = (Number(curVitals.workload || 50) / 100) * 0.55;
          animPartsRef.current.carriageGroup.position.x =
            0.15 + Math.sin(elapsedTime * feedSpeed) * 0.32;
        }

        if (animPartsRef.current.atcGroup && !isFailed) {
          animPartsRef.current.atcGroup.rotation.y += 0.003;
        }

        if (animPartsRef.current.thermalLight) {
          const tempRatio = Math.max(0, Math.min(1, (temp - 40) / 60));
          animPartsRef.current.thermalLight.intensity = !isFailed ? tempRatio * 1.5 : 0;
        }

        if (animPartsRef.current.coolantStream) {
          animPartsRef.current.coolantStream.visible = !isFailed && rpm > 400;
        }

        if (animPartsRef.current.spindleGroup) {
          if (vibration > 2.0 && !isFailed) {
            const jitter = (vibration / 8.0) * 0.02;
            animPartsRef.current.spindleGroup.position.x = (Math.random() - 0.5) * jitter;
          } else {
            animPartsRef.current.spindleGroup.position.x = 0;
          }
        }
      }

      // 3D Printers Mechanics Animation
      else if (
        resolvedSubtype === "fdm-printer" ||
        resolvedSubtype === "industrial-printer"
      ) {
        const printSpeed = isFailed ? 0 : Number(curVitals.rpm || 65);
        if (animPartsRef.current.printHeadGroup && printSpeed > 0 && !isFailed) {
          const speedFactor = (printSpeed / 60) * 1.8;
          animPartsRef.current.printHeadGroup.position.x =
            Math.sin(elapsedTime * speedFactor) * 0.48;

          if (animPartsRef.current.bedGroup) {
            animPartsRef.current.bedGroup.position.z =
              Math.cos(elapsedTime * speedFactor * 0.6) * 0.22;
          }
        }

        if (animPartsRef.current.fanBlades && !isFailed) {
          animPartsRef.current.fanBlades.rotation.z += 0.4;
        }
      }

      // Laptop Digital Twin - Dynamic Real-time Screen Drawing (Clean SCADA)
      else if (resolvedSubtype === "laptop") {
        const screenCanvas = animPartsRef.current.screenCanvas;
        const screenTexture = animPartsRef.current.screenTexture;

        if (screenCanvas && screenTexture) {
          const ctx = screenCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#0f172a"; // Solid dark SCADA monitor
            ctx.fillRect(0, 0, 512, 320);

            // Top Header Bar
            ctx.fillStyle = "#1e293b";
            ctx.fillRect(0, 0, 512, 36);

            ctx.fillStyle = "#f8fafc";
            ctx.font = "bold 12px ui-monospace, monospace";
            ctx.fillText("RISKGUARD SCADA • INDUSTRIAL TELEMETRY", 16, 23);

            // Charger Indicator
            const isPlugged = curAcConnected;
            ctx.fillStyle = isPlugged ? "#22c55e" : "#c7a84b";
            ctx.font = "bold 11px ui-monospace, monospace";
            ctx.fillText(
              isPlugged ? "[ AC CONNECTED: HIGH LOAD ]" : "[ ON BATTERY: IDLE ]",
              300,
              23
            );

            // Clean Real-Time Oscilloscope Waveform (Factory Amber or Green)
            ctx.strokeStyle = isPlugged ? "#16a34a" : "#c7a84b";
            ctx.lineWidth = 2.0;
            ctx.beginPath();

            const waveBaseY = 135;
            const freq = (Number(curVitals.workload || 50) / 100) * 5;
            const amp = isFailed ? 3 : (Number(curVitals.vibration || 1.2) / 4) * 30;

            for (let x = 0; x < 512; x += 4) {
              const y =
                waveBaseY +
                Math.sin(x * 0.04 + elapsedTime * freq) * amp +
                Math.sin(x * 0.08 - elapsedTime * 2.5) * (amp * 0.35);
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Clean Telemetry Rows (No neon glow)
            ctx.fillStyle = "#94a3b8";
            ctx.font = "11px ui-monospace, monospace";
            ctx.fillText(
              `CPU FREQ: ${isFailed ? 0 : curVitals.rpm || 2600} MHz    CORE TEMP: ${curVitals.temperature || 52} °C`,
              20,
              220
            );
            ctx.fillText(
              `POWER DRAW: ${curVitals.motor_current || 35} W    WORKLOAD: ${curVitals.workload || 40}%`,
              20,
              245
            );
            ctx.fillText(
              `STATUS: ${curCondition}    ACCELEROMETER: ${curVitals.vibration || 0.5} mm/s`,
              20,
              270
            );

            // Status bar
            ctx.fillStyle =
              curCondition === "NORMAL"
                ? "#16a34a"
                : curCondition === "WARNING"
                ? "#c7a84b"
                : "#dc2626";
            ctx.fillRect(0, 314, 512, 6);

            screenTexture.needsUpdate = true;
          }
        }

        // Side USB-C Charger LED (Green = AC Connected, Amber = Battery)
        if (animPartsRef.current.chargerLed && animPartsRef.current.chargerLight) {
          const ledColor = curAcConnected ? 0x16a34a : 0xc7a84b;
          animPartsRef.current.chargerLed.material.color.setHex(ledColor);
          animPartsRef.current.chargerLed.material.emissive.setHex(ledColor);
          animPartsRef.current.chargerLight.color.setHex(ledColor);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    const resetCamera = () => {
      camera.position.copy(defaultCamPos);
      controls.target.copy(defaultCamTarget);
      controls.update();
    };

    container._resetCamera = resetCamera;

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [machineId, resolvedSubtype]);

  const handleResetCamera = () => {
    if (containerRef.current && containerRef.current._resetCamera) {
      containerRef.current._resetCamera();
    }
  };

  const subtypeLabelMap = {
    "cnc-milling": "CNC Milling Center",
    "cnc-lathe": "CNC Lathe Machine",
    "cnc-vmc": "CNC Vertical Machining Center",
    "cnc-turning": "CNC Turning Center",
    "fdm-printer": "FDM 3D Printer",
    "industrial-printer": "Industrial 3D Printer",
    laptop: "Physical Signal Laptop Driver",
  };
  const activeLabel = subtypeLabelMap[resolvedSubtype] || "Industrial Asset";

  const isLaptop = resolvedSubtype === "laptop";
  const isPrinter = resolvedSubtype.includes("printer");

  // Dynamic machine condition and warning resolution
  const statusInfo = getMachineStatusInfo(
    condition,
    vitals,
    resolvedSubtype,
    machineType
  );

  return (
    <div className="machine-3d-wrapper">
      <div ref={containerRef} className="machine-3d-canvas" />

      {/* Floating HUD Top */}
      <div className="viewer-hud-top">
        <div className="viewer-identity">
          <div className="hud-badge-group">
            <span className="hud-model-code">{machineId}</span>
            <span className="hud-model-type">{activeLabel}</span>
          </div>
          <div className="hud-status-indicator">
            {statusInfo.type === "NORMAL" && (
              <span className="hud-pill pill-normal">
                <CheckCircle2 size={12} />
                NORMAL
              </span>
            )}
            {statusInfo.type === "WARNING" && (
              <span className="hud-pill pill-warning">
                <AlertTriangle size={12} />
                {statusInfo.label}
              </span>
            )}
            {statusInfo.type === "CRITICAL" && (
              <span className="hud-pill pill-critical">
                <AlertTriangle size={12} />
                {statusInfo.label}
              </span>
            )}
            {statusInfo.type === "FAILED" && (
              <span className="hud-pill pill-failed">
                <Zap size={12} />
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>

        <div className="viewer-actions">
          <button
            type="button"
            className={`hud-icon-btn ${heatmapMode ? "is-active" : ""}`}
            title="Toggle Thermal Monitoring"
            onClick={() => setHeatmapMode((prev) => !prev)}
          >
            <Flame size={14} />
            <span>Thermal View</span>
          </button>

          <button
            type="button"
            className="hud-icon-btn"
            title="Reset Camera View"
            onClick={handleResetCamera}
          >
            <RotateCcw size={14} />
            <span>Reset View</span>
          </button>
        </div>
      </div>

      {/* Floating HUD Bottom */}
      <div className="viewer-hud-bottom">
        <div className="hud-telemetry-chip">
          <Activity size={13} className="text-blue" />
          <span>
            {isLaptop
              ? "Fan Speed:"
              : isPrinter
              ? "Print Speed:"
              : "Spindle Speed:"}{" "}
            <strong>
              {condition === "FAILED" ? "0" : vitals.rpm || (isLaptop ? 2600 : isPrinter ? 65 : 3200)}{" "}
              {isPrinter ? "mm/s" : "RPM"}
            </strong>
          </span>
        </div>

        <div className="hud-telemetry-chip">
          <Flame size={13} className="text-amber" />
          <span>
            {isLaptop
              ? "CPU Package:"
              : isPrinter
              ? "Hotend Temp:"
              : "Spindle Temp:"}{" "}
            <strong>
              {vitals.temperature || (isLaptop ? 52 : isPrinter ? 215 : 55)} °C
            </strong>
          </span>
        </div>

        <div className="hud-telemetry-chip">
          <Cpu size={13} className="text-cyan" />
          <span>
            Operating Load: <strong>{vitals.workload || 50}%</strong>
          </span>
        </div>

        <div className="hud-orbit-hint">
          <span>Drag to orbit • Scroll to zoom</span>
        </div>
      </div>
    </div>
  );
}

export default Machine3DViewer;
