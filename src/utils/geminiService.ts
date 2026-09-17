export interface ParsedNotaItem {
  name: string;
  quantity: number;
  buyPrice: number;
  unit: string;
}

export interface ParseNotaResponse {
  success: boolean;
  mode: 'gemini-api' | 'mock' | 'fallback-mock' | 'offline-client';
  items: ParsedNotaItem[];
  warning?: string;
  message?: string;
}

/**
 * Convert a browser File or Blob to a base64 string
 */
export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Call the secure backend proxy endpoint /api/parse-nota to extract receipt items via Gemini
 */
export const parseNotaPasar = async (
  fileOrBase64: File | Blob | string,
  mimeType: string = 'image/jpeg'
): Promise<ParseNotaResponse> => {
  let imageBase64: string;

  if (typeof fileOrBase64 === 'string') {
    imageBase64 = fileOrBase64;
  } else {
    imageBase64 = await fileToBase64(fileOrBase64);
    if ('type' in fileOrBase64 && fileOrBase64.type) {
      mimeType = fileOrBase64.type;
    }
  }

  try {
    const response = await fetch('/api/parse-nota', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data: ParseNotaResponse = await response.json();
    return data;
  } catch (error: any) {
    console.warn('[Kasirio AI Service] Backend proxy unreachable, using client offline simulation:', error);

    // Realistic offline simulation if network is completely down
    return {
      success: true,
      mode: 'offline-client',
      items: [
        { name: 'Bawang Merah Brebes', quantity: 3, buyPrice: 28000, unit: 'Kg' },
        { name: 'Cabai Rawit Merah', quantity: 2, buyPrice: 45000, unit: 'Kg' },
        { name: 'Minyak Goreng Curah', quantity: 5, buyPrice: 16500, unit: 'Liter' },
        { name: 'Telur Ayam Ras', quantity: 10, buyPrice: 26000, unit: 'Kg' },
      ],
      warning: 'Server proxy offline. Ditampilkan data simulasi kulakan pasar.',
    };
  }
};

/**
 * Call the secure backend proxy endpoint /api/business-briefing
 */
export const getAiBusinessBriefing = async (
  omzet: number,
  profit: number,
  transactionCount: number
): Promise<string[]> => {
  try {
    const response = await fetch('/api/business-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ omzet, profit, transactionCount }),
    });

    if (!response.ok) throw new Error('Proxy error');
    const data = await response.json();
    return data.insights || [];
  } catch (err) {
    return [
      `Omzet Anda tercatat Rp ${omzet.toLocaleString('id-ID')} dengan laba Rp ${profit.toLocaleString('id-ID')}.`,
      'Periksa persediaan barang yang menipis untuk menjaga kelancaran transaksi.',
      'Sistem kasir offline berjalan optimal melindungi data transaksi lokal.',
    ];
  }
};
