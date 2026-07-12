"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

/**
 * Camera-based QR scanner using the native BarcodeDetector API — no external
 * dependency. Falls back to a clear message where the API/camera is unavailable
 * (e.g. Safari/Firefox), so the user can still type the asset tag manually.
 */
export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Detector = (window as any).BarcodeDetector;
      if (!Detector) {
        setError(
          "QR scanning isn't supported in this browser. Use Chrome or Edge, or type the tag manually.",
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        setError(
          "Camera access was denied. Allow camera permission, or type the tag manually.",
        );
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            onScanRef.current(codes[0].rawValue);
            return; // first hit wins; parent closes the scanner
          }
        } catch {
          /* transient detect errors between frames are expected */
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-[var(--af-radius)] border border-[var(--af-border)] bg-[var(--af-surface)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Camera className="h-4 w-4 text-[var(--af-accent)]" /> Scan Asset QR
          </h4>
          <button
            onClick={onClose}
            className="text-[var(--af-muted)] transition hover:text-white cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="py-8 text-center text-xs text-red-400">{error}</p>
        ) : (
          <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-[var(--af-accent)]/70" />
          </div>
        )}
        <p className="mt-3 text-center text-2xs text-[var(--af-muted)]">
          Point the camera at an asset&apos;s QR code.
        </p>
      </div>
    </div>
  );
}
