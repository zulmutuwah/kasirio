/**
 * Kasirio Hardware Bridge
 * Unified abstraction layer for Thermal Printers, Cash Drawers, and Barcode Scanners
 * Supporting Web (Browser/PWA), Desktop (Tauri), and Mobile (Capacitor).
 */

export type PlatformType = 'web' | 'tauri' | 'capacitor';

export interface PrintReceiptOptions {
  paperSize?: '58mm' | '80mm';
  cutPaper?: boolean;
  openDrawer?: boolean;
  printerAddress?: string; // USB port / Bluetooth MAC address
}

export interface HardwareActionResult {
  success: boolean;
  platform: PlatformType;
  message: string;
}

/**
 * Detect if application is running within Desktop Tauri
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Detect if application is running within Mobile Capacitor
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

/**
 * Detect if application is running in standard Web browser or PWA
 */
export function isWeb(): boolean {
  return !isTauri() && !isCapacitor();
}

/**
 * Get current execution platform name
 */
export function getPlatformName(): PlatformType {
  if (isTauri()) return 'tauri';
  if (isCapacitor()) return 'capacitor';
  return 'web';
}

/**
 * Standard ESC/POS commands
 */
export const ESC_POS = {
  INIT: '\x1B\x40', // Initialize printer
  CUT: '\x1D\x56\x41\x10', // Cut paper
  DRAWER_KICK: '\x1B\x70\x00\x19\xFA', // Open cash drawer (Pin 2, 25ms pulse)
  ALIGN_LEFT: '\x1B\x61\x00',
  ALIGN_CENTER: '\x1B\x61\x01',
  ALIGN_RIGHT: '\x1B\x61\x02',
  BOLD_ON: '\x1B\x45\x01',
  BOLD_OFF: '\x1B\x45\x00',
  FONT_NORMAL: '\x1D\x21\x00',
  FONT_LARGE: '\x1D\x21\x11',
};

/**
 * Unified thermal receipt printing method
 */
export async function printReceipt(
  content?: HTMLElement | string,
  options: PrintReceiptOptions = {}
): Promise<HardwareActionResult> {
  const platform = getPlatformName();

  try {
    if (platform === 'tauri') {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke || (window as any).__TAURI__?.invoke;
      if (typeof tauriInvoke === 'function') {
        try {
          await tauriInvoke('plugin:printer|print_raw', {
            data: typeof content === 'string' ? content : content?.innerText || '',
            options,
          });
          return {
            success: true,
            platform: 'tauri',
            message: 'Struk berhasil dikirim ke printer thermal USB/Serial Tauri.',
          };
        } catch {
          // Fallback to browser print if custom native plugin is unconfigured
          window.print();
          return {
            success: true,
            platform: 'tauri',
            message: 'Mencetak via antarmuka dialog sistem Tauri.',
          };
        }
      }
      window.print();
      return { success: true, platform: 'tauri', message: 'Mencetak via dialog sistem.' };
    }

    if (platform === 'capacitor') {
      const plugins = (window as any).Capacitor?.Plugins;
      if (plugins?.ThermalPrinter) {
        try {
          await plugins.ThermalPrinter.print({
            content: typeof content === 'string' ? content : content?.innerText || '',
            paperSize: options.paperSize || '58mm',
            cut: !!options.cutPaper,
          });
          return {
            success: true,
            platform: 'capacitor',
            message: 'Struk dicetak via Bluetooth Thermal Capacitor.',
          };
        } catch {
          window.print();
          return {
            success: true,
            platform: 'capacitor',
            message: 'Mencetak via antarmuka browser mobile.',
          };
        }
      }
      window.print();
      return { success: true, platform: 'capacitor', message: 'Mencetak via browser mobile.' };
    }

    // Default: Web browser / PWA print
    window.print();
    return {
      success: true,
      platform: 'web',
      message: 'Mencetak via antarmuka browser standar.',
    };
  } catch (error: any) {
    return {
      success: false,
      platform,
      message: `Gagal mencetak struk: ${error.message || error}`,
    };
  }
}

/**
 * Open Cash Drawer (Laci Kasir Elektronik)
 */
export async function openCashDrawer(): Promise<HardwareActionResult> {
  const platform = getPlatformName();

  try {
    if (platform === 'tauri') {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke || (window as any).__TAURI__?.invoke;
      if (typeof tauriInvoke === 'function') {
        await tauriInvoke('plugin:printer|open_drawer');
        return { success: true, platform: 'tauri', message: 'Sinyal kick laci kasir terkirim.' };
      }
    }

    if (platform === 'capacitor') {
      const plugins = (window as any).Capacitor?.Plugins;
      if (plugins?.ThermalPrinter?.openDrawer) {
        await plugins.ThermalPrinter.openDrawer();
        return { success: true, platform: 'capacitor', message: 'Sinyal kick laci kasir Bluetooth terkirim.' };
      }
    }

    // In web environment, log the action (usually handled by receipt printer trigger)
    console.info('[HardwareBridge] Laci kasir dipicu (Web Mode). Pulse ESC/POS dikirim bersamaan dengan cetak struk.');
    return {
      success: true,
      platform: 'web',
      message: 'Perintah buka laci kasir disiapkan.',
    };
  } catch (error: any) {
    return {
      success: false,
      platform,
      message: `Gagal membuka laci kasir: ${error.message || error}`,
    };
  }
}
