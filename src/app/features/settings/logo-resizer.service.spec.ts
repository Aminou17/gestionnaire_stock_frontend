import { TestBed } from "@angular/core/testing";

import { LogoResizerService } from "./logo-resizer.service";

describe("LogoResizerService", () => {
    let service: LogoResizerService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(LogoResizerService);
    });

    // le dessin sur canvas n'existe pas dans jsdom : seuls les refus sont testés ici
    it("should refuse a file that is not an image", async () => {
        const file = new File(["x"], "notes.pdf", { type: "application/pdf" });

        await expect(service.resize(file)).rejects.toThrow("Choisissez une image PNG ou JPEG.");
    });

    it("should refuse an SVG because it can carry a script", async () => {
        const file = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

        await expect(service.resize(file)).rejects.toThrow("Choisissez une image PNG ou JPEG.");
    });

    it("should refuse a GIF or a WebP image", async () => {
        const file = new File(["x"], "logo.gif", { type: "image/gif" });

        await expect(service.resize(file)).rejects.toThrow("Choisissez une image PNG ou JPEG.");
    });

    it("should refuse a file above 5 MB before decoding it", async () => {
        const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "photo.png", {
            type: "image/png",
        });

        await expect(service.resize(file)).rejects.toThrow("trop lourde");
    });
});
