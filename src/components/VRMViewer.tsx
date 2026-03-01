import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import type { Emotion } from "../lib/emotion";
import type { PoseConfig, AnimationConfig, CameraConfig } from "../lib/config";
import { DEFAULT_POSE, DEFAULT_ANIMATION, DEFAULT_CAMERA } from "../lib/config";
import { createIdleScheduler, updateIdleScheduler, type IdleSchedulerState } from "../lib/idle-actions";

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

/**
 * Reset all animation-affected bones to rest pose.
 * Called at the START of every frame before any animation is applied.
 * This prevents += accumulation bugs across frames.
 */
function resetToRestPose(vrm: VRM, pose: PoseConfig, hipsBaseY: number) {
  const armRad = deg2rad(pose.armDown);
  const elbowRad = deg2rad(pose.elbowBend);

  const bones: Record<string, { rx?: number; ry?: number; rz?: number; px?: number; py?: number }> = {
    hips:           { rz: 0, px: 0, py: hipsBaseY },
    spine:          { rx: 0, rz: 0 },
    neck:           { rx: 0 },
    head:           { rx: 0, ry: 0, rz: 0 },
    leftUpperArm:   { rz: -armRad },
    rightUpperArm:  { rz: armRad },
    leftLowerArm:   { rz: -elbowRad },
    rightLowerArm:  { rz: elbowRad },
    leftShoulder:   { rz: 0 },
    rightShoulder:  { rz: 0 },
  };

  for (const [name, vals] of Object.entries(bones)) {
    const node = vrm.humanoid?.getNormalizedBoneNode(name);
    if (!node) continue;
    if (vals.rx !== undefined) node.rotation.x = vals.rx;
    if (vals.ry !== undefined) node.rotation.y = vals.ry;
    if (vals.rz !== undefined) node.rotation.z = vals.rz;
    if (vals.px !== undefined) node.position.x = vals.px;
    if (vals.py !== undefined) node.position.y = vals.py;
  }

  // Reset expressions that idle actions may set
  vrm.expressionManager?.setValue("blink", 0);
  vrm.expressionManager?.setValue("happy", 0);
  vrm.expressionManager?.setValue("lookLeft", 0);
  vrm.expressionManager?.setValue("lookRight", 0);
  vrm.expressionManager?.setValue("lookUp", 0);
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

  /**
   * Base idle animation — absolute values layered on rest pose.
   * Uses = (assignment) so values are deterministic per-frame.
   */
  const applyIdleAnimation = useCallback((vrm: VRM, elapsed: number) => {
    const a = animRef.current;
    const speed = a.animationSpeed;
    const breathScale = a.breathingIntensity / 100;
    const headScale = a.headSwayIntensity / 100;

    // Breathing — hips Y oscillation (= assignment, not +=)
    const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
    if (hips) {
      hips.position.y = hipsBaseY.current + Math.sin(elapsed * 1.5 * speed) * 0.003 * breathScale;
    }

    // Spine breathing
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

        // Capture hips base Y for breathing reference
        const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
        if (hips) hipsBaseY.current = hips.position.y;

        // Apply initial rest pose
        resetToRestPose(vrm, poseRef.current, hipsBaseY.current);

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
        // 1. Reset ALL animated bones to rest pose (prevents += accumulation)
        resetToRestPose(vrm, poseRef.current, hipsBaseY.current);
        // 2. Base idle animation (breathing, sway) — uses = assignment
        applyIdleAnimation(vrm, elapsed);
        // 3. Random idle actions (blink, look, etc.) — uses += additive deltas
        //    Safe because step 1 already reset everything
        updateIdleScheduler(idleScheduler.current, vrm, elapsed);
        // 4. Speaking mouth animation
        applySpeakingAnimation(vrm, elapsed);
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
