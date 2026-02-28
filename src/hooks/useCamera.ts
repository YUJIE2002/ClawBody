/**
 * useCamera — Webcam capture hook for AI vision
 *
 * Captures frames from the user's webcam at low FPS as base64 JPEG.
 * Designed to be lightweight — small resolution, low quality,
 * minimal bandwidth for sending to the AI gateway.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseCameraOptions {
  /** Capture width (default: 320) */
  width?: number;
  /** Capture height (default: 240) */
  height?: number;
  /** JPEG quality 0-1 (default: 0.6) */
  quality?: number;
  /** Auto-capture interval in ms (default: 0 = disabled) */
  autoCaptureFps?: number;
  /** Called when a frame is auto-captured */
  onFrame?: (base64: string) => void;
}

export interface UseCameraReturn {
  /** Whether camera is currently active */
  active: boolean;
  /** Whether the browser supports getUserMedia */
  supported: boolean;
  /** Error message if camera failed */
  error: string | null;
  /** Start the camera */
  start: () => Promise<void>;
  /** Stop the camera */
  stop: () => void;
  /** Take a single snapshot, returns base64 JPEG data URL */
  snapshot: () => string | null;
  /** Ref to attach to a <video> element for preview */
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const {
    width = 320,
    height = 240,
    quality = 0.6,
    autoCaptureFps = 0,
    onFrame,
  } = options;

  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() =>
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  /** Get or create the offscreen canvas for frame capture */
  const getCanvas = useCallback((): HTMLCanvasElement => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }
    return canvasRef.current;
  }, [width, height]);

  /** Capture current video frame as base64 JPEG */
  const snapshot = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !active) return null;

    const canvas = getCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  }, [active, getCanvas, width, height, quality]);

  /** Start webcam capture */
  const start = useCallback(async () => {
    if (!supported) {
      setError("Camera not supported in this browser");
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setActive(true);

      // Set up auto-capture if requested
      if (autoCaptureFps > 0 && onFrameRef.current) {
        const intervalMs = 1000 / autoCaptureFps;
        intervalRef.current = setInterval(() => {
          const frame = snapshot();
          if (frame) {
            onFrameRef.current?.(frame);
          }
        }, intervalMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ClawBody] Camera error:", msg);
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Camera permission denied");
      } else if (msg.includes("NotFoundError")) {
        setError("No camera found");
      } else {
        setError(`Camera error: ${msg}`);
      }
      setActive(false);
    }
  }, [supported, width, height, autoCaptureFps, snapshot]);

  /** Stop webcam capture */
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    active,
    supported,
    error,
    start,
    stop,
    snapshot,
    videoRef,
  };
}
