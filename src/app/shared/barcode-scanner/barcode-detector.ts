// Lecture des codes-barres : le détecteur du navigateur quand il existe (Chrome sur Android),
// sinon une version WebAssembly (iPhone, Firefox), chargée seulement au premier scan
// et servie par l'application elle-même, pour marcher aussi sans internet.
export interface Detector {
    detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

let detector: Promise<Detector> | null = null;

export function getBarcodeDetector(): Promise<Detector> {
    if (detector) return detector;

    detector = (async () => {
        const native = (globalThis as { BarcodeDetector?: any }).BarcodeDetector;

        if (native) {
            try {
                const supported: string[] = await native.getSupportedFormats();
                const formats = FORMATS.filter((format) => supported.includes(format));
                if (formats.includes("ean_13")) return new native({ formats }) as Detector;
            } catch {
                // détecteur présent mais inutilisable : on prend la version WebAssembly
            }
        }

        const { BarcodeDetector, setZXingModuleOverrides } =
            await import("barcode-detector/ponyfill");
        setZXingModuleOverrides({
            locateFile: (path: string, prefix: string) =>
                path.endsWith(".wasm") ? "/zxing/zxing_reader.wasm" : prefix + path,
        });
        return new BarcodeDetector({ formats: FORMATS as any }) as Detector;
    })();

    detector.catch(() => (detector = null));
    return detector;
}
