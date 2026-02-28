/**
 * VRM Model Loading Utilities
 *
 * Provides helper functions for loading, validating, and managing
 * VRM models in the ClawBody application.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRM } from "@pixiv/three-vrm";

/** Cached loader instance (reusable across loads) */
let loaderInstance: GLTFLoader | null = null;

/**
 * Get or create a GLTFLoader with the VRM plugin registered.
 */
function getLoader(): GLTFLoader {
  if (!loaderInstance) {
    loaderInstance = new GLTFLoader();
    loaderInstance.register((parser) => new VRMLoaderPlugin(parser));
  }
  return loaderInstance;
}

/**
 * Load a VRM model from a URL.
 *
 * @param url - Path or URL to the .vrm file
 * @param onProgress - Optional progress callback (0.0 - 1.0)
 * @returns The loaded VRM instance
 * @throws If the file cannot be loaded or is not a valid VRM
 */
export async function loadVRM(
  url: string,
  onProgress?: (progress: number) => void,
): Promise<VRM> {
  const loader = getLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) {
          reject(new Error(`File is not a valid VRM model: ${url}`));
          return;
        }
        // Face the camera by default
        vrm.scene.rotation.y = Math.PI;
        resolve(vrm);
      },
      (event) => {
        if (onProgress && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      },
      (error) => {
        reject(new Error(`Failed to load VRM model: ${error}`));
      },
    );
  });
}

/**
 * Dispose of a VRM model and free GPU resources.
 *
 * @param vrm - The VRM instance to dispose
 */
export function disposeVRM(vrm: VRM): void {
  vrm.scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      for (const mat of materials) {
        // Dispose all texture maps
        for (const key of Object.keys(mat)) {
          const value = (mat as Record<string, unknown>)[key];
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
        mat.dispose();
      }
    }
  });
}

/**
 * Get metadata from a loaded VRM model.
 * Handles both VRM 0.x and VRM 1.x metadata formats.
 */
export function getVRMInfo(vrm: VRM): Record<string, string | undefined> {
  const meta = vrm.meta;
  if (!meta) return {};

  if (meta.metaVersion === "1") {
    return {
      name: meta.name,
      version: meta.metaVersion,
      authors: meta.authors?.join(", "),
      licenseUrl: meta.licenseUrl,
    };
  }

  // VRM 0.x
  return {
    name: meta.title,
    version: meta.metaVersion,
    authors: meta.author,
    licenseUrl: meta.otherLicenseUrl,
  };
}
