# Magazyn Brzeźnicka — frontend GitHub Pages

Adres: https://lucjanpartyka-art.github.io/magazyn-brzeznicka/

To osobny frontend względem HTML publikowanego w Google Apps Script. Korzysta z tego samego backendu, ale zmiany HTML w Apps Script nie aktualizują GitHub Pages.

## Skaner 2026.10.05.2

- ZXing-C++ przez zxing-wasm 3.1.4 działa lokalnie w Web Workerze. JS i WASM są hostowane wraz ze stroną. Pierwsze uruchomienie wymaga pobrania silnika.
- Obsługiwane formaty: EAN-13, EAN-8, UPC-A, UPC-E i numeryczny Code 128. EAN/UPC są walidowane, a kilka kodów na zdjęciu wymaga wyboru użytkownika.
- Zdjęcie nie jest kompresowane ponownie do JPEG przed odczytem. Rozmiar canvasu jest ograniczony do 2560 px, sprawdzane są różne skale, obrót oraz dwa sposoby binaryzacji i środek kadru.
- Podgląd kamery jest zatrzymywany przed otwarciem aparatu systemowego. Spóźniona zgoda na kamerę nie uruchamia poprzedniego skanera. Powrót z aparatu nie uruchamia go ponownie automatycznie; służy do tego przycisk „Uruchom skaner na żywo”.
- Szkic produktu i ilość są zapisywane przed otwarciem aparatu i przy ukryciu strony. Po ponownym zalogowaniu przywracany jest wyłącznie własny szkic w tym samym dokumencie. Odczyt kodów nie korzysta z Gemini.

## Testowanie

`npm ci --ignore-scripts` i `npm test` uruchamiają testy dekodowania obrazów, sum kontrolnych, spóźnionej zgody na kamerę i przywracania formularza.

`python3 -m http.server 8765 --bind 127.0.0.1` pozwala otworzyć `tests/scanner.html`. Test przeglądarkowy używa rzeczywistego Workera i WASM oraz syntetycznego strumienia wideo; nie żąda dostępu do fizycznej kamery ani nie zapisuje danych magazynowych.

Przykłady obrazów przedstawiają EAN 8936020052557: standardowy, obrócony, EXIF orientation=6, 4032×3024 i symulowane zakrzywienie. Nie są to klatki z nagrania użytkownika. Próba na rzeczywistym iPhonie i butelce jest nadal konieczna, zwłaszcza przy odblaskach i nieostrym obrazie.

## Zależności

`vendor/zxing-reader-3.1.4.js` i `vendor/zxing_reader.wasm` pochodzą z przypiętego pakietu npm `zxing-wasm@3.1.4`. Licencje w `vendor/`. Zmiana wersji wymaga aktualizacji obu plików oraz testów; nie używać ruchomego adresu `@latest`.

## Wersja 2026.10.06.1 — odczyt nazwy

Błędy i puste odpowiedzi AI uruchamiają zapasowy OCR polskiego i angielskiego tekstu na urządzeniu. Pierwszy odczyt wymaga pobrania modułu Tesseract 6.0.1 i danych językowych; etykieta nie jest wysyłana do dostawcy biblioteki. Odczyt można ponowić z zapisanego zdjęcia. Wpisanej nazwy nie nadpisuje spóźniona odpowiedź; sugestię można zaakceptować przyciskiem. `tests/photo-name.html` sprawdza rzeczywisty lokalny OCR przy symulowanym błędzie AI.

## Wersja 2026.10.06.2 — niepewny tekst OCR

Lokalny OCR przedstawia wyłącznie propozycję do zatwierdzenia i nie wypełnia nazwy automatycznie. Odrzuca rozpoznane hasła reklamowe i wyniki poniżej progu pewności. Test na prostej etykiecie nie zastępuje sprawdzenia zdjęcia rzeczywistego opakowania.

## Wersja 2026.10.06.3 — bez AI podczas liczenia

Odczyt etykiety w formularzu odbywa się wyłącznie lokalnie (OCR). Zdjęcie nie jest przekazywane do Gemini, również przy błędzie OCR. Nazwę z odczytu użytkownik zatwierdza sam. Zdjęcie daty jest załącznikiem; datę i partię wpisuje się ręcznie. Katalog i skaner działają jak dotychczas. Analiza AI może dotyczyć dopiero plików zapisanych przy rekordach w bazie; formularz nie uruchamia takiej analizy.
