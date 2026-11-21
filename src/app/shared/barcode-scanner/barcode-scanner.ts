import {
    Component,
    DestroyRef,
    ElementRef,
    inject,
    output,
    signal,
    viewChild,
} from "@angular/core";

import { Icon } from "../icon/icon";
import { getBarcodeDetector } from "./barcode-detector";

// Scanner plein écran : caméra arrière, viseur, lampe si le téléphone en a une,
// et saisie à la main quand la caméra n'est pas disponible.
// durée du flash vert avant de refermer le scanner
const FOUND_DELAY = 650;

@Component({
    selector: "app-barcode-scanner",
    imports: [Icon],
    templateUrl: "./barcode-scanner.html",
    styleUrl: "./barcode-scanner.css",
})
export class BarcodeScanner {
    readonly scanned = output<string>();

    private dialog = viewChild.required<ElementRef<HTMLDialogElement>>("box");
    private video = viewChild.required<ElementRef<HTMLVideoElement>>("video");

    status = signal<"starting" | "scanning" | "found" | "error">("starting");
    // dernier code lu, montré le temps du flash vert
    code = signal("");
    message = signal("");
    torch = signal<boolean | null>(null);
    manual = signal("");

    private stream: MediaStream | null = null;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private open = false;

    constructor() {
        inject(DestroyRef).onDestroy(() => this.stop());
    }

    async start() {
        this.open = true;
        this.status.set("starting");
        this.message.set("");
        this.manual.set("");
        this.torch.set(null);
        this.dialog().nativeElement.showModal();

        if (!navigator.mediaDevices?.getUserMedia) {
            this.fail("La caméra n'est pas disponible sur cet appareil. Saisissez le code.");
            return;
        }

        try {
            const [stream, detector] = await Promise.all([
                navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
                    audio: false,
                }),
                getBarcodeDetector(),
            ]);

            // fermé pendant le chargement
            if (!this.open) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            this.stream = stream;
            const video = this.video().nativeElement;
            video.srcObject = stream;
            await video.play();

            const track = stream.getVideoTracks()[0];
            const capabilities = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
            if (capabilities.torch) this.torch.set(false);

            this.status.set("scanning");
            this.loop(detector);
        } catch (err) {
            const name = (err as DOMException)?.name;
            this.fail(
                name === "NotAllowedError"
                    ? "Autorisez l'accès à la caméra dans les réglages du navigateur, ou saisissez le code."
                    : name === "NotFoundError"
                      ? "Aucune caméra trouvée. Saisissez le code."
                      : "Impossible d'ouvrir la caméra. Saisissez le code.",
            );
        }
    }

    private loop(detector: { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }) {
        const tick = async () => {
            if (!this.open) return;
            const video = this.video().nativeElement;

            try {
                if (video.readyState >= 2) {
                    const [found] = await detector.detect(video);
                    if (found?.rawValue) {
                        this.found(found.rawValue);
                        return;
                    }
                }
            } catch {
                // image illisible : on essaie la suivante
            }

            this.timer = setTimeout(tick, 120);
        };
        void tick();
    }

    async toggleTorch() {
        const track = this.stream?.getVideoTracks()[0];
        if (!track || this.torch() === null) return;

        const on = !this.torch();
        try {
            await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
            this.torch.set(on);
        } catch {
            this.torch.set(null);
        }
    }

    submitManual() {
        const code = this.manual().trim();
        if (code) this.done(code);
    }

    // lecture réussie : bip, vibration et flash vert un instant, puis on rend le code
    private found(code: string) {
        this.status.set("found");
        this.code.set(code.trim());
        navigator.vibrate?.(60);
        this.beep();
        this.timer = setTimeout(() => this.done(code), FOUND_DELAY);
    }

    private done(code: string) {
        this.close();
        this.scanned.emit(code.trim());
    }

    // petit « bip » de caisse, sans fichier son
    private beep() {
        try {
            const Audio = window.AudioContext;
            if (!Audio) return;
            const context = new Audio();
            const tone = context.createOscillator();
            const volume = context.createGain();
            tone.type = "sine";
            tone.frequency.value = 1568;
            volume.gain.setValueAtTime(0.18, context.currentTime);
            volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
            tone.connect(volume).connect(context.destination);
            tone.start();
            tone.stop(context.currentTime + 0.16);
            tone.onended = () => void context.close();
        } catch {
            // pas de son : la vibration et le flash suffisent
        }
    }

    private fail(text: string) {
        this.status.set("error");
        this.message.set(text);
    }

    close() {
        this.open = false;
        this.stop();
        const dialog = this.dialog().nativeElement;
        if (dialog.open) dialog.close();
    }

    private stop() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
    }
}
