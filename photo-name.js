/* Odczyt etykiety na urządzeniu. Zdjęcie nie jest wysyłane do dostawcy biblioteki. */
let photoOcrWorkerPromise;
let photoOcrProgress = () => {};
function withOcrTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
function loadPhotoOcrLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return withOcrTimeout(new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
    script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Nie uruchomiono odczytu tekstu.'));
    script.onerror = () => { script.remove(); reject(new Error('Nie pobrano modułu odczytu tekstu. Sprawdź internet i spróbuj ponownie.')); };
    document.head.appendChild(script);
  }), 20000, 'Pobieranie modułu odczytu trwa zbyt długo. Spróbuj ponownie.');
}
async function recognizePhotoLocally(dataUrl, onProgress) {
  photoOcrProgress = onProgress;
  let worker;
  try {
    if (!photoOcrWorkerPromise) {
      photoOcrWorkerPromise = (async () => {
        const engine = await loadPhotoOcrLibrary();
        return engine.createWorker('pol+eng', 1, {
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
          logger: event => {
            const percent = Math.round((event.progress || 0) * 100);
            photoOcrProgress(event.status === 'recognizing text' ? `Odczytywanie etykiety na urządzeniu: ${percent}%` : 'Przygotowanie odczytu tekstu… Pierwsze uruchomienie wymaga pobrania modułu.');
          }
        });
      })();
    }
    const pending = photoOcrWorkerPromise;
    try { worker = await withOcrTimeout(pending, 45000, 'Nie udało się przygotować odczytu tekstu. Spróbuj ponownie.'); }
    catch (error) { pending.then(w => w.terminate()).catch(() => {}); throw error; }
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const result = await withOcrTimeout(worker.recognize(dataUrl), 30000, 'Odczyt zdjęcia trwa zbyt długo. Zrób bliższe, ostre zdjęcie etykiety.');
    const name = nameFromOcrText(result.data.text);
    if (!name || Number(result.data.confidence) < 65) throw new Error('Nie odczytano czytelnej nazwy. Zrób ostre zdjęcie przodu opakowania lub wpisz nazwę ręcznie.');
    return { name, text: result.data.text, source: 'local-ocr', needsReview: true };
  } catch (error) {
    if (worker) await worker.terminate().catch(() => {});
    photoOcrWorkerPromise = null;
    throw error;
  } finally { photoOcrProgress = () => {}; if (worker) await worker.terminate().catch(() => {}); photoOcrWorkerPromise = null; }
}
function nameFromOcrText(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim().replace(/\s+/g, ' '))
    .filter(line => /[a-ząćęłńóśźż]/i.test(line) && line.length >= 2)
    .filter(line => !/^(składniki|ingredients|wartości odżywcze|nutrition|www\.|https?:|kod partii|batch|lot\b|exp\b)/i.test(line));
  // Hasła z góry opakowania nie mogą zastępować nazwy produktu.
  const candidates = lines.filter(line => !/^(new\b|nowo[śs][ćc]\b|our best\b|advanced\b|improved\b|nowa formu[łl]a\b|streak free\b|sparkling clean\b)/i.test(line))
    .filter(line => !/[!|{}<>]/.test(line));
  return [...new Set(candidates)].slice(0, 10).join(' ').slice(0, 240);
}

// Odczyt w formularzu jest wyłącznie lokalny: nie przyjmuje klienta AI.
const PhotoName = {
  async recognize(image, local, progress = () => {}) {
    progress('Odczytuję tekst na urządzeniu…');
    const result = await local(image, progress);
    return { ...result, source: 'local-ocr', needsReview: true };
  }
};
if (typeof module !== 'undefined') module.exports = { PhotoName, nameFromOcrText };
