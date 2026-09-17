import { useEffect, useRef } from 'react';

export interface BarcodeBufferOptions {
  maxIntervalMs?: number; // Maximum inter-keystroke interval to be considered a hardware scan (default: 50ms)
  minLength?: number;     // Minimum character length for a valid barcode (default: 3)
}

/**
 * Pure helper class to manage keystroke buffer timing for hardware barcode scanners.
 * Hardware scanners (USB/Bluetooth HID) emulate a keyboard sending characters with
 * very short delays (<30-50ms) and finish with 'Enter'.
 */
export class BarcodeBuffer {
  private buffer: string = '';
  private lastKeyTime: number = 0;
  private readonly maxIntervalMs: number;
  private readonly minLength: number;

  constructor(options: BarcodeBufferOptions = {}) {
    this.maxIntervalMs = options.maxIntervalMs ?? 50;
    this.minLength = options.minLength ?? 3;
  }

  /**
   * Process a key event. Returns the scanned barcode if this key completes a valid scan,
   * or null if the key is accumulating or reset.
   */
  public handleKey(key: string, timestamp: number = Date.now()): string | null {
    // If Enter/Return is pressed, evaluate the buffered characters
    if (key === 'Enter') {
      const isFastEnough = (timestamp - this.lastKeyTime) <= this.maxIntervalMs;
      const barcode = this.buffer.trim();
      this.reset();

      if (barcode.length >= this.minLength && (isFastEnough || barcode.length > 0)) {
        return barcode;
      }
      return null;
    }

    // Ignore modifier keys and function keys
    if (key.length > 1) {
      return null;
    }

    // Check interval since previous keystroke
    const interval = timestamp - this.lastKeyTime;
    if (this.buffer.length > 0 && interval > this.maxIntervalMs) {
      // Human typing speed detected (> maxIntervalMs) -> reset buffer to start fresh with this key
      this.buffer = key;
    } else {
      // Fast keystroke -> append to buffer
      this.buffer += key;
    }

    this.lastKeyTime = timestamp;
    return null;
  }

  public getBuffer(): string {
    return this.buffer;
  }

  public reset(): void {
    this.buffer = '';
    this.lastKeyTime = 0;
  }
}

export interface UseBarcodeScannerOptions extends BarcodeBufferOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

/**
 * React hook that captures hardware barcode scans globally across the POS window.
 * Distinguishes hardware scanners from manual keyboard typing via inter-keystroke latency (<50ms).
 */
export const useBarcodeScanner = ({
  onScan,
  enabled = true,
  maxIntervalMs = 50,
  minLength = 3,
}: UseBarcodeScannerOptions) => {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<BarcodeBuffer>(
    new BarcodeBuffer({ maxIntervalMs, minLength })
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow user to interact with input elements normally, unless it is an ultra-fast burst
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // If user is typing in a modal PIN or general text input, avoid intercepting if it's slow
      // But if it's the barcode hardware, feed to buffer
      const result = bufferRef.current.handleKey(e.key, Date.now());

      if (result) {
        // If it was captured as a valid barcode scan:
        // Prevent default form submission or newline
        e.preventDefault();
        onScanRef.current(result);

        // If the focused element was a search input, clear it so it doesn't leave leftover text
        if (isInput && target instanceof HTMLInputElement) {
          target.value = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled]);
};
