import { describe, it, expect } from 'vitest';
import { BarcodeBuffer } from '../utils/useBarcodeScanner';

describe('Barcode Buffer Hardware Timing Suite', () => {
  it('harus mendeteksi rentetan keystroke cepat (<50ms) dari barcode scanner fisik sebagai scan valid', () => {
    const scanner = new BarcodeBuffer({ maxIntervalMs: 50, minLength: 5 });
    const barcodeText = '899990900123';
    let baseTime = 1000;

    let result: string | null = null;
    for (const char of barcodeText) {
      baseTime += 15; // 15ms interval (sangat cepat, khas scanner hardware)
      result = scanner.handleKey(char, baseTime);
      expect(result).toBeNull(); // masih mengakumulasi di buffer
    }

    // Karakter penutup Enter
    baseTime += 15;
    result = scanner.handleKey('Enter', baseTime);

    expect(result).toBe('899990900123');
    expect(scanner.getBuffer()).toBe(''); // Buffer harus di-reset setelah scan sukses
  });

  it('harus mereset buffer jika jeda antar karakter lambat (>50ms) seperti ketikan lambat manusia', () => {
    const scanner = new BarcodeBuffer({ maxIntervalMs: 50, minLength: 3 });
    let baseTime = 1000;

    // Karakter 'A'
    scanner.handleKey('A', baseTime);

    // Jeda 200ms (ketikan lambat manusia) lalu ketik 'B'
    baseTime += 200;
    scanner.handleKey('B', baseTime);

    // Buffer harus membuang 'A' dan hanya menyimpan 'B'
    expect(scanner.getBuffer()).toBe('B');

    // Jeda 150ms lalu ketik 'C'
    baseTime += 150;
    scanner.handleKey('C', baseTime);
    expect(scanner.getBuffer()).toBe('C');
  });

  it('harus mengabaikan scan jika panjang karakter di bawah minLength', () => {
    const scanner = new BarcodeBuffer({ maxIntervalMs: 50, minLength: 4 });
    let baseTime = 1000;

    // Ketik cepat tapi hanya 2 karakter: "12" + Enter
    scanner.handleKey('1', baseTime + 10);
    scanner.handleKey('2', baseTime + 20);
    const result = scanner.handleKey('Enter', baseTime + 30);

    expect(result).toBeNull();
  });

  it('harus mengabaikan tombol modifier (Shift, Alt, Control, dll)', () => {
    const scanner = new BarcodeBuffer({ maxIntervalMs: 50, minLength: 3 });
    let baseTime = 1000;

    scanner.handleKey('Shift', baseTime + 10);
    scanner.handleKey('Control', baseTime + 20);
    scanner.handleKey('F1', baseTime + 30);

    expect(scanner.getBuffer()).toBe('');
  });
});
