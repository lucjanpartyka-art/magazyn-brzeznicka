/* Jeden dekoder w Workerze; kamera zatrzymywana przed otwarciem aparatu systemowego. */
(function (root) {
  'use strict';
  const workerUrl = typeof document !== 'undefined' && document.currentScript ? new URL('barcode-worker.js?v=20261005-2', document.currentScript.src).href : 'barcode-worker.js?v=20261005-2';
  function validCode(value, format) {
    const code = String(value || '').trim();
    if (!/^\d{6,14}$/.test(code)) return '';
    if (format === 'EAN13' || format === 'EAN8' || format === 'UPCA') {
      const size = { EAN13: 13, EAN8: 8, UPCA: 12 }[format];
      if (code.length !== size) return '';
      let sum = 0;
      for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(code[i]) * weight;
      if ((10 - sum % 10) % 10 !== Number(code.charAt(code.length - 1))) return '';
    }
    return code;
  }
  class Scanner {
    constructor() { this.worker = null; this.pending = new Map(); this.seq = 0; this.generation = 0; this.stream = null; this.timer = null; this.starting = false; }
    request(payload, transfers = []) {
      if (!this.worker) {
        this.worker = new Worker(workerUrl);
        this.worker.onmessage = ({ data }) => {
          const job = this.pending.get(data.id); if (!job) return;
          clearTimeout(job.timer); this.pending.delete(data.id);
          data.error ? job.reject(new Error(data.error)) : job.resolve(data.results);
        };
        this.worker.onerror = () => this.destroy(new Error('Nie uruchomiono skanera. Odśwież stronę przy włączonym internecie.'));
      }
      return new Promise((resolve, reject) => {
        const id = ++this.seq;
        const timer = setTimeout(() => this.destroy(new Error('Odczyt trwa zbyt długo. Spróbuj ponownie.')), 20000);
        this.pending.set(id, { resolve, reject, timer });
        try { this.worker.postMessage({ ...payload, id }, transfers); }
        catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
      });
    }
    destroy(error = new Error('Odczyt przerwany.')) {
      this.stop();
      if (this.worker) this.worker.terminate(); this.worker = null;
      for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(error); }
      this.pending.clear();
    }
    async decode(canvas, binarizer) {
      const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
      const results = await this.request({ width: pixels.width, height: pixels.height, buffer: pixels.data.buffer, binarizer }, [pixels.data.buffer]);
      return [...new Set(results.map(r => validCode(r.text, r.format)).filter(Boolean))];
    }
    stop() {
      this.generation++; clearTimeout(this.timer); this.timer = null; this.starting = false;
      if (this.stream) this.stream.getTracks().forEach(t => t.stop()); this.stream = null;
      if (this.video) { this.video.pause(); this.video.srcObject = null; } this.video = null;
    }
    async start(video, onCodes, onError) {
      if (this.stream || this.starting) return;
      this.starting = true; const generation = ++this.generation;
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 15, max: 24 } } });
      let stream;
      try {
        stream = await streamPromise;
        if (generation !== this.generation) { stream.getTracks().forEach(t => t.stop()); return; }
        this.stream = stream; this.video = video;
        video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.focusMode && caps.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        await this.request({ type: 'ready' });
        if (generation !== this.generation) return;
        this.starting = false;
        const canvas = document.createElement('canvas');
        const tick = async () => {
          if (generation !== this.generation) return;
          try {
            if (video.readyState >= 2 && video.videoWidth) {
              const scale = Math.min(1, 1440 / Math.max(video.videoWidth, video.videoHeight));
              canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
              canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
              const codes = await this.decode(canvas);
              if (generation !== this.generation) return;
              if (codes.length) { this.stop(); onCodes(codes); return; }
            }
            if (generation === this.generation) this.timer = setTimeout(tick, 160);
          } catch (error) { if (generation === this.generation) { this.stop(); onError(error); } }
        };
        tick();
      } catch (error) {
        if (stream && generation !== this.generation) stream.getTracks().forEach(t => t.stop());
        if (generation === this.generation) { this.stop(); throw error; }
      }
    }
    async photo(file, onProgress = () => {}) {
      this.stop();
      let source, objectUrl;
      try {
        onProgress('Przygotowuję zdjęcie…');
        if (typeof createImageBitmap === 'function') {
          try { source = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: 2560, resizeQuality: 'high' }); } catch (_) {}
        }
        if (!source) {
          objectUrl = URL.createObjectURL(file);
          source = await new Promise((resolve, reject) => {
            const img = new Image(); img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Nie można otworzyć zdjęcia. Wybierz JPG lub PNG.')); img.src = objectUrl;
          });
        }
        const scale = Math.min(1, 2560 / Math.max(source.width, source.height));
        const base = document.createElement('canvas'); base.width = Math.round(source.width * scale); base.height = Math.round(source.height * scale);
        base.getContext('2d').drawImage(source, 0, 0, base.width, base.height);
        if (source.close) { source.close(); source = null; }
        // Bez ponownej kompresji JPEG. Dekoder sprawdza również obrót i inne skale.
        for (const method of ['LocalAverage', 'GlobalHistogram']) {
          onProgress('Odczytuję kod ze zdjęcia…');
          const codes = await this.decode(base, method); if (codes.length) return codes;
        }
        onProgress('Sprawdzam środek etykiety…');
        const crop = document.createElement('canvas'); crop.width = Math.round(base.width * .8); crop.height = Math.round(base.height * .6);
        crop.getContext('2d').drawImage(base, base.width * .1, base.height * .2, crop.width, crop.height, 0, 0, crop.width, crop.height);
        return await this.decode(crop);
      } finally { if (source && source.close) source.close(); if (objectUrl) URL.revokeObjectURL(objectUrl); }
    }
  }
  root.WarehouseScanner = { Scanner, validCode };
  if (typeof module !== 'undefined') module.exports = root.WarehouseScanner;
})(typeof window !== 'undefined' ? window : globalThis);
