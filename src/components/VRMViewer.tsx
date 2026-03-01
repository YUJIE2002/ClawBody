import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import type { Emotion } from "../lib/emotion";
import type { PoseConfig, AnimationConfig, CameraConfig } from "../lib/config";
import { DEFAULT_POSE, DEFAULT_ANIMATION, DEFAULT_CAMERA } from "../lib/config";
import { createIdleScheduler, updateIdleScheduler, type IdleSchedulerState } from "../lib/idle-actions";

interface VRMViewerProps {
  /** URL to the VRM model file */
  modelUrl: string;
  /** Current emotion state from OpenClaw */
  emotion: Emotion;
  /** Whether the character is currently speaking */
  speaking: boolean;
  /** External lip sync mouth open amount (0-1). Overrides speaking animation when set. */
  mouthOpen?: number;
  /** Pose configuration (arm angles, etc.) */
  pose?: PoseConfig;
  /** Animation configuration (breathing, sway, speed) */
  animation?: AnimationConfig;
  /** Camera configuration (position, FOV) */
  camera?: CameraConfig;
}

/** Convert degrees to radians */
const deg2rad = (deg: number) => deg * (Math.PI / 180);

/**
 * VRMViewer — Three.js scene that renders a VRM avatar
 */
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
  const hipsBaseY = useRef<number | null>(null);
  const idleScheduler = useRef<IdleSchedulerState>(createIdleScheduler());

  // Store latest props in refs for animation loop access
  const emotionRef = useRef(emotion);
  const speakingRef = useRef(speaking);
  const mouthOpenRef = useRef(mouthOpen);
  const poseRef = useRef(poseConfig ?? DEFAULT_POSE);
  const animRef = useRef(animConfig ?? DEFAULT_ANIMATION);
  const camRef = useRef(camConfig ?? DEFAULT_CAMERA);

  useEffect(() => { emotionRef.current = emotion; }, [emotion]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { mouthOpenRef.current = mouthOpen; }, [mouthOpen]);
  useEffect(() => { poseRef.current = poseConfig ?? DEFAULT_POSE; }, [poseConfig]);
  useEffect(() => { animRef.current = animConfig ?? DEFAULT_ANIMATION; }, [animConfig]);
  useEffect(() => { camRef.current = camConfig ?? DEFAULT_CAMERA; }, [camConfig]);

  // Apply pose whenever config changes
  useEffect(() => {
    const vrm = vrmRef.current;
    if (!vrm) return;
    const p = poseConfig ?? DEFAULT_POSE;
    const armRad = deg2rad(p.armDown);
    const elbowRad = deg2rad(p.elbowBend);

    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
    const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");

    if (leftUpperArm) leftUpperArm.rotation.z = -armRad;
    if (rightUpperArm) rightUpperArm.rotation.z = armRad;
    if (leftLowerArm) leftLowerArm.rotation.z = -elbowRad;
    if (rightLowerArm) rightLowerArm.rotation.z = elbowRad;
  }, [poseConfig]);

  // Apply camera config whenever it changes
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const c = camConfig ?? DEFAULT_CAMERA;
    camera.fov = c.fov;
    camera.position.set(0, c.cameraHeight, c.cameraDistance);
    camera.lookAt(0, c.lookAtHeight, 0);
    camera.updateProjectionMatrix();
  }, [camConfig]);

  /**
   * Apply idle animation driven by animRef config.
   */
  const applyIdleAnimation = useCallback((vrm: VRM, elapsed: number) => {
    const a = animRef.current;
    const speed = a.animationSpeed;
    const breathScale = a.breathingIntensity / 100;
    const headScale = a.headSwayIntensity / 100;

    // Breathing — hips Y oscillation
    const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
    if (hips) {
      if (hipsBaseY.current === null) {
        hipsBaseY.current = hips.position.y;
      }
      hips.position.y = hipsBaseY.current + Math.sin(elapsed * 1.5 * speed) * 0.003 * breathScale;
    }

    // Spine breathing (chest expand)
    const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.x = Math.sin(elapsed * 1.5 * speed) * 0.012 * breathScale;
    }

    // Head sway
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.y = Math.sin(elapsed * 0.5 * speed) * 0.05 * headScale;
      head.rotation.z = Math.sin(elapsed * 0.3 * speed) * 0.02 * headScale;
    }
  }, []);

  /**
   * Mouth animation for speaking.
   */
  const applySpeakingAnimation = useCallback((vrm: VRM, elapsed: number) => {
    const externalMouth = mouthOpenRef.current;
    if (externalMouth !== undefined && externalMouth > 0) {
      vrm.expressionManager?.setValue("aa", externalMouth);
      return;
    }
    if (!speakingRef.current) {
      vrm.expressionManager?.setValue("aa", 0);
      return;
    }
    const speed = animRef.current.animationSpeed;
    const openAmount = (Math.sin(elapsed * 12 * speed) + 1) * 0.3;
    vrm.expressionManager?.setValue("aa", openAmount);
  }, []);

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);
    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    rimLight.position.set(-1, 1, -2);
    scene.add(rimLight);

    // Load VRM model
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      modelUrl,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        if (!vrm) {
          console.error("[ClawBody] Loaded file is not a valid VRM model");
          return;
        }

        vrm.scene.rotation.y = 0;
        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // Apply initial rest pose from config
        const p = poseRef.current;
        const armRad = deg2rad(p.armDown);
        const elbowRad = deg2rad(p.elbowBend);

        const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
        const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
        const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
        const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");

        if (leftUpperArm) leftUpperArm.rotation.z = -armRad;
        if (rightUpperArm) rightUpperArm.rotation.z = armRad;
        if (leftLowerArm) leftLowerArm.rotation.z = -elbowRad;
        if (rightLowerArm) rightLowerArm.rotation.z = elbowRad;

        // Capture hips base Y for breathing
        const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
        if (hips) hipsBaseY.current = hips.position.y;

        console.log("[ClawBody] VRM model loaded, pose applied");
      },
      (progress) => {
        const pct = ((progress.loaded / progress.total) * 100).toFixed(1);
        console.log(`[ClawBody] Loading model: ${pct}%`);
      },
      (error) => {
        console.error("[ClawBody] Failed to load VRM model:", error);
      },
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
        applyIdleAnimation(vrm, elapsed);
        applySpeakingAnimation(vrm, elapsed);
        // Random idle actions (blink, look around, weight shift, etc.)
        updateIdleScheduler(idleScheduler.current, vrm, elapsed);
        vrm.update(delta);
      }
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      hipsBaseY.current = null;
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
  }, [modelUrl, applyIdleAnimation, applySpeakingAnimation]);

  return (
    <div
      ref={containerRef}
      className="vrm-viewer"
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    />
  );
}
