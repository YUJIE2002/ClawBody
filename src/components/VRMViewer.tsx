import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";
import type { Emotion } from "../lib/emotion";

interface VRMViewerProps {
  /** URL to the VRM model file */
  modelUrl: string;
  /** Current emotion state from OpenClaw */
  emotion: Emotion;
  /** Whether the character is currently speaking */
  speaking: boolean;
  /** External lip sync mouth open amount (0-1). Overrides speaking animation when set. */
  mouthOpen?: number;
}

/**
 * VRMViewer — Three.js scene that renders a VRM avatar
 *
 * This component creates a WebGL canvas with a transparent background,
 * loads a VRM model, and applies emotion-driven expressions and
 * idle animations. Designed to be the core visual element of ClawBody.
 */
export default function VRMViewer({ modelUrl, emotion, speaking, mouthOpen }: VRMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<VRM | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const hipsBaseY = useRef<number | null>(null);

  // Store latest props in refs for animation loop access
  const emotionRef = useRef(emotion);
  const speakingRef = useRef(speaking);
  const mouthOpenRef = useRef(mouthOpen);
  useEffect(() => { emotionRef.current = emotion; }, [emotion]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { mouthOpenRef.current = mouthOpen; }, [mouthOpen]);

  /**
   * Apply idle breathing animation to the VRM model.
   * Subtle vertical oscillation to make the character feel alive.
   */
  const applyIdleAnimation = useCallback((vrm: VRM, elapsed: number) => {
    // Gentle breathing motion — use absolute position, not accumulation
    const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
    if (hips) {
      // Capture base Y position on first call
      if (hipsBaseY.current === null) {
        hipsBaseY.current = hips.position.y;
      }
      hips.position.y = hipsBaseY.current + Math.sin(elapsed * 1.5) * 0.002;
    }

    // Subtle head sway
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.y = Math.sin(elapsed * 0.5) * 0.03;
      head.rotation.z = Math.sin(elapsed * 0.3) * 0.01;
    }

    // Subtle spine breathing (chest expansion)
    const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.x = Math.sin(elapsed * 1.5) * 0.008;
    }
  }, []);

  /**
   * Simulate mouth movement when speaking.
   * If external mouthOpen is provided (from TTS lip sync), use that directly.
   * Otherwise falls back to a simple sine wave oscillation.
   */
  const applySpeakingAnimation = useCallback((vrm: VRM, elapsed: number) => {
    const externalMouth = mouthOpenRef.current;

    // If external lip sync is driving the mouth, use it directly
    if (externalMouth !== undefined && externalMouth > 0) {
      vrm.expressionManager?.setValue("aa", externalMouth);
      return;
    }

    if (!speakingRef.current) {
      // Close mouth when not speaking
      vrm.expressionManager?.setValue("aa", 0);
      return;
    }

    // Fallback: oscillate mouth open/close for speech
    const openAmount = (Math.sin(elapsed * 12) + 1) * 0.3;
    vrm.expressionManager?.setValue("aa", openAmount);
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene setup ---
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      28, // Slightly narrower FOV to reduce edge distortion
      container.clientWidth / container.clientHeight,
      0.1,
      20,
    );
    camera.position.set(0, 1.25, 2.8); // Pull back slightly, lower camera
    camera.lookAt(0, 1.15, 0); // Center on upper chest to keep head fully visible

    const renderer = new THREE.WebGLRenderer({
      alpha: true, // Transparent background — critical for desktop overlay
      antialias: true,
      premultipliedAlpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // Fully transparent
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // --- Lighting ---
    // Soft ambient + directional for natural character lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(1, 2, 3);
    scene.add(directionalLight);

    // Subtle rim light from behind for depth
    const rimLight = new THREE.DirectionalLight(0x88ccff, 0.4);
    rimLight.position.set(-1, 1, -2);
    scene.add(rimLight);

    // --- Load VRM model ---
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

        // VRM models face +Z by default — try both orientations
        // Some models need PI rotation, others don't
        vrm.scene.rotation.y = 0;
        scene.add(vrm.scene);
        vrmRef.current = vrm;

        // Apply natural rest pose (fix T-pose)
        // Lower arms from horizontal T-pose to a relaxed position
        const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
        const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
        const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");
        const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");

        if (leftUpperArm) {
          leftUpperArm.rotation.z = -1.1; // ~63° down from horizontal
        }
        if (rightUpperArm) {
          rightUpperArm.rotation.z = 1.1;
        }
        if (leftLowerArm) {
          leftLowerArm.rotation.z = -0.15; // Slight bend at elbow
        }
        if (rightLowerArm) {
          rightLowerArm.rotation.z = 0.15;
        }

        console.log("[ClawBody] VRM model loaded, rest pose applied");
      },
      (progress) => {
        const pct = ((progress.loaded / progress.total) * 100).toFixed(1);
        console.log(`[ClawBody] Loading model: ${pct}%`);
      },
      (error) => {
        console.error("[ClawBody] Failed to load VRM model:", error);
      },
    );

    // --- Animation loop ---
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
        vrm.update(delta);
      }

      renderer.render(scene, camera);
    };
    animate();

    // --- Handle resize ---
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // --- Cleanup ---
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
