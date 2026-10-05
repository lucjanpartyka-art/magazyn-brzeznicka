/* Dekodowanie poza wątkiem interfejsu; pliki są hostowane razem z aplikacją. */
importScripts('vendor/zxing-reader-3.1.4.js');
const ready = ZXingWASM.prepareZXingModule({
  overrides: { locateFile: path => new URL('vendor/' + path, self.location.href).href },
  fireImmediately: true
});
self.onmessage = async ({ data }) => {
  try {
    await ready;
    if (data.type === 'ready') { self.postMessage({ id: data.id, results: [] }); return; }
    const results = await ZXingWASM.readBarcodes(new ImageData(new Uint8ClampedArray(data.buffer), data.width, data.height), {
      formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE', 'Code128'],
      tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true,
      maxNumberOfSymbols: 4, binarizer: data.binarizer || 'LocalAverage'
    });
    self.postMessage({ id: data.id, results: results.map(r => ({ text: r.text, format: r.format })) });
  } catch (error) { self.postMessage({ id: data.id, error: error.message || String(error) }); }
};
