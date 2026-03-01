import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import type { Emotion } from "../lib/emotion";
import type { PoseConfig, AnimationConfig, CameraConfig } from "../lib/config";
import { DEFAULT_POSE, DEFAULT_ANIMATION, DEFAULT_CAMERA } from "../lib/config";
import {
  createIdleScheduler,
  tickIdleScheduler,
  type IdleSchedulerState,
  type ActionOutput,
} from "../lib/idle-actions";

interface VRMViewerProps {
  modelUrl: string;
  emotion: Emotion;
  speaking: boolean;
  mouthOpen?: number;
  pose?: PoseConfig;
  animation?: AnimationConfig;
  camera?: CameraConfig;
}

const deg2rad = (deg: number) => deg * (Math.PI / 180);

/** Helper: get bone or null */
function bone(vrm: VRM, name: string) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
}

/**
 * The ONE place where all bone values are set each frame.
 *
 * Computes final value = restPose + baseAnimation + actionDelta
 * and assigns with = (never +=). No accumulation possible.
 */
function applyFrame(
  vrm: VRM,
  pose: PoseConfig,
  hipsBaseY: number,
  elapsed: number,
  anim: AnimationConfig,
  action: ActionOutput,
  speaking: boolean,
  mouthOpen: number | undefined,
  animSpeed: number,
) {
  const breathScale = anim.breathingIntensity / 100;
  const headScale = anim.headSwayIntensity / 100;
  const speed = anim.animationSpeed;

  // Helper: get action bone delta (defaults to 0)
  const ad = (boneName: string, axis: "rx" | "ry" | "rz" | "px" | "py") =>
    action.bones[boneName]?.[axis] ?? 0;

  // ── Hips ──
  const hips = bone(vrm, "hips");
  if (hips) {
    const breathY = Math.sin(elapsed * 1.5 * speed) * 0.003 * breathScale;
    hips.position.x = 0 + ad("hips", "px");
    hips.position.y = hipsBaseY + breathY + ad("hips", "py");
    hips.rotation.z = 0 + ad("hips", "rz");
  }

  // ── Spine ──
  const spine = bone(vrm, "spine");
  if (spine) {
    const breathX = Math.sin(elapsed * 1.5 * speed) * 0.012 * breathScale;
    spine.rotation.x = breathX + ad("spine", "rx");
    spine.rotation.z = 0 + ad("spine", "rz");
  }

  // ── Neck ──
  const neck = bone(vrm, "neck");
  if (neck) {
    neck.rotation.x = 0 + ad("neck", "rx");
  }

  // ── Head ──
  const head = bone(vrm, "head");
  if (head) {
    const swayY = Math.sin(elapsed * 0.5 * speed) * 0.05 * headScale;
    const swayZ = Math.sin(elapsed * 0.3 * speed) * 0.02 * headScale;
    head.rotation.x = 0 + ad("head", "rx");
    head.rotation.y = swayY + ad("head", "ry");
    head.rotation.z = swayZ + ad("head", "rz");
  }

  // ── Arms (rest pose only, actions don't touch these) ──
  const armRad = deg2rad(pose.armDown);
  const elbowRad = deg2rad(pose.elbowBend);

  const lua = bone(vrm, "leftUpperArm");
  if (lua) lua.rotation.z = -armRad;
  const rua = bone(vrm, "rightUpperArm");
  if (rua) rua.rotation.z = armRad;
  const lla = bone(vrm, "leftLowerArm");
  if (lla) lla.rotation.z = -elbowRad;
  const rla = bone(vrm, "rightLowerArm");
  if (rla) rla.rotation.z = elbowRad;

  // ── Shoulders ──
  const ls = bone(vrm, "leftShoulder");
  if (ls) ls.rotation.z = 0 + ad("leftShoulder", "rz");
  const rs = bone(vrm, "rightShoulder");
  if (rs) rs.rotation.z = 0 + ad("rightShoulder", "rz");

  // ── Expressions ──
  // Action expressions (blink, lookLeft, etc.)
  vrm.expressionManager?.setValue("blink", action.expressions.blink ?? 0);
  vrm.expressionManager?.setValue("happy", action.expressions.happy ?? 0);
  vrm.expressionManager?.setValue("lookLeft", action.expressions.lookLeft ?? 0);
  vrm.expressionManager?.setValue("lookRight", action.expressions.lookRight ?? 0);
  vrm.expressionManager?.setValue("lookUp", action.expressions.lookUp ?? 0);

  // ── Mouth (speaking) ──
  if (mouthOpen !== undefined && mouthOpen > 0) {
    vrm.expressionManager?.setValue("aa", mouthOpen);
  } else if (speaking) {
    const openAmount = (Math.sin(elapsed * 12 * speed) + 1) * 0.3;
    vrm.expressionManager?.setValue("aa", openAmount);
  } else {
    vrm.expressionManager?.setValue("aa", 0);
  }
}

export default function VRMViewer({
  modelUrl, emotion, speaking, mouthOpen,
  pose: poseConfig,
  animation: animConfig,
  camera: camConfig,
}: VRMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const hipsBaseY = useRef<number>(0);
  const idleScheduler = useRef<IdleSchedulerState>(createIdleScheduler());

  // Refs for animation loop access
  const poseRef = useRef(poseConfig ?? DEFAULT_POSE);
  const animRef = useRef(animConfig ?? DEFAULT_ANIMATION);
  const camRef = useRef(camConfig ?? DEFAULT_CAMERA);
  const speakingRef = useRef(speaking);
  const mouthOpenRef = useRef(mouthOpen);

  useEffect(() => { poseRef.current = poseConfig ?? DEFAULT_POSE; }, [poseConfig]);
  useEffect(() => { animRef.current = animConfig ?? DEFAULT_ANIMATION; }, [animConfig]);
  useEffect(() => { camRef.current = camConfig ?? DEFAULT_CAMERA; }, [camConfig]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { mouthOpenRef.current = mouthOpen; }, [mouthOpen]);

  // Camera config reactive update
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const c = camConfig ?? DEFAULT_CAMERA;
    camera.fov = c.fov;
    camera.position.set(0, c.cameraHeight, c.cameraDistance);
    camera.lookAt(0, c.lookAtHeight, 0);
    camera.updateProjectionMatrix();
  }, [camConfig]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const c = camRef.current;

    const camera = new THREE.PerspectiveCamera(
      c.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      20,
    );
    camera.position.set(0, c.cameraHeight, c.cameraDistance);
    camera.lookAt(0, c.lookAtHeight, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(1, 2, 3);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0x88ccff, 0.4);
    rim.position.set(-1, 1, -2);
    scene.add(rim);

    // Load VRM
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      modelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) return;

        vrm.scene.rotation.y = 0;
        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // Capture rest position
        const h = vrm.humanoid?.getNormalizedBoneNode("hips");
        if (h) hipsBaseY.current = h.position.y;

        console.log("[ClawBody] VRM loaded, hipsBaseY:", hipsBaseY.current);
      },
      undefined,
      (error) => console.error("[ClawBody] VRM load failed:", error),
    );

    // Animation loop
    const clock = clockRef.current;
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();
      const vrm = vrmRef.current;

      if (vrm) {
        // Get action deltas (pure computation, no bone modification)
        const actionDeltas = tickIdleScheduler(idleScheduler.current, elapsed);

        // Single unified bone assignment — ALL values set with = per frame
        applyFrame(
          vrm,
          poseRef.current,
          hipsBaseY.current,
          elapsed,
          animRef.current,
          actionDeltas,
          speakingRef.current,
          mouthOpenRef.current,
          animRef.current.animationSpeed,
        );

        vrm.update(delta);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      if (vrmRef.current) {
        vrmRef.current.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
    };
  }, [modelUrl]);

  return (
    <div
      ref={containerRef}
      className="vrm-viewer"
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }}
    />
  );
}
