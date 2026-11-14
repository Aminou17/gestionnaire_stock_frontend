import { TestBed } from "@angular/core/testing";

import { PhotoZoom } from "./photo-zoom";

describe("PhotoZoom", () => {
    // jsdom ne connaît pas showModal : on imite l'ouverture et l'évènement close
    beforeEach(() => {
        HTMLDialogElement.prototype.showModal = function () {
            this.setAttribute("open", "");
        };
        HTMLDialogElement.prototype.close = function () {
            this.removeAttribute("open");
            this.dispatchEvent(new Event("close"));
        };
    });

    async function render() {
        const fixture = TestBed.createComponent(PhotoZoom);
        fixture.componentRef.setInput("src", "data:image/webp;base64,AAA");
        fixture.componentRef.setInput("name", "Riz parfumé 1 kg");
        await fixture.whenStable();
        return fixture;
    }

    it("should show the photo with the name of the product", async () => {
        const fixture = await render();
        const el: HTMLElement = fixture.nativeElement;

        expect(el.querySelector("img")?.getAttribute("alt")).toBe("Riz parfumé 1 kg");
        expect(el.querySelector("p")?.textContent).toBe("Riz parfumé 1 kg");
    });

    it("should open as a modal dialog", async () => {
        const fixture = await render();
        const dialog = fixture.nativeElement.querySelector("dialog") as HTMLDialogElement;

        expect(dialog.open).toBe(true);
    });

    it("should close once on a click on the photo", async () => {
        const fixture = await render();
        const closed = vi.fn();
        fixture.componentInstance.closed.subscribe(closed);

        fixture.nativeElement.querySelector("img").click();

        expect(closed).toHaveBeenCalledTimes(1);
    });

    it("should close once on the cross", async () => {
        const fixture = await render();
        const closed = vi.fn();
        fixture.componentInstance.closed.subscribe(closed);

        fixture.nativeElement.querySelector(".zoom-close").click();

        expect(closed).toHaveBeenCalledTimes(1);
    });
});
