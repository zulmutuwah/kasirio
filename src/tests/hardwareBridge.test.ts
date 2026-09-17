import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isTauri,
  isCapacitor,
  isWeb,
  getPlatformName,
  printReceipt,
  openCashDrawer,
} from '../utils/hardwareBridge';

describe('Kasirio Hardware Bridge', () => {
  const originalWindow = (globalThis as any).window;

  beforeEach(() => {
    // Setup window on globalThis for Node test runner
    (globalThis as any).window = {
      print: vi.fn(),
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('correctly identifies Web / PWA environment as default', () => {
    expect(isTauri()).toBe(false);
    expect(isCapacitor()).toBe(false);
    expect(isWeb()).toBe(true);
    expect(getPlatformName()).toBe('web');
  });

  it('correctly detects Tauri Desktop environment when globals exist', () => {
    (window as any).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
    expect(getPlatformName()).toBe('tauri');
  });

  it('correctly detects Capacitor Mobile environment when native platform is true', () => {
    (window as any).Capacitor = {
      isNativePlatform: () => true,
    };
    expect(isCapacitor()).toBe(true);
    expect(isWeb()).toBe(false);
    expect(getPlatformName()).toBe('capacitor');
  });

  it('triggers window.print in web environment without error', async () => {
    const printMock = vi.fn();
    window.print = printMock;

    const result = await printReceipt(undefined, { paperSize: '58mm' });
    expect(result.success).toBe(true);
    expect(result.platform).toBe('web');
    expect(printMock).toHaveBeenCalledOnce();
  });

  it('opens cash drawer command safely in web environment', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = await openCashDrawer();
    expect(result.success).toBe(true);
    expect(result.platform).toBe('web');
    expect(consoleSpy).toHaveBeenCalled();
  });
});
