import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CloseCashDialog } from "./close-cash-dialog";

describe("CloseCashDialog", () => {
    let fixture: ComponentFixture<CloseCashDialog>;
    let el: HTMLElement;
    let httpMock: HttpTestingController;
    let dialog: HTMLDialogElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CloseCashDialog],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(CloseCashDialog);
        el = fixture.nativeElement;
        httpMock = TestBed.inject(HttpTestingController);
        await fixture.whenStable();

        // jsdom n'implémente pas showModal / close
        dialog = el.querySelector("dialog")!;
        dialog.showModal = function () {
            this.open = true;
        };
        dialog.close = function () {
            this.open = false;
        };
    });

    afterEach(() => httpMock.verify());

    const text = () => el.textContent!.replace(/\s+/g, "");

    async function typeAmount(value: string) {
        const input = el.querySelector<HTMLInputElement>("input")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function typeNote(value: string) {
        const input = el.querySelector<HTMLTextAreaElement>("textarea")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function clickSubmit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should close the session of the given date and notify", async () => {
        const closed = vi.fn();
        fixture.componentInstance.closed.subscribe(closed);
        fixture.componentInstance.open("2026-11-10", 61500);
        await typeAmount("61500");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body).toEqual({
            sessionDate: "2026-11-10",
            actualAmount: 61500,
            closingNote: "",
        });
        req.flush({ id: 1 });
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
        expect(closed).toHaveBeenCalled();
    });

    it("should tell how much is missing or in excess before closing", async () => {
        fixture.componentInstance.open("2026-11-10", 61500);
        await fixture.whenStable();
        expect(text()).toContain("Soldeattendu61500F");

        await typeAmount("61000");
        expect(text()).toContain("Ilmanque500Fdansletiroir.");

        await typeAmount("62000");
        expect(text()).toContain("Ilya500Fdeplusqueprévudansletiroir.");

        await typeAmount("61500");
        expect(text()).toContain("correspondausoldeattendu");
    });

    it("should ask to explain a gap before closing", async () => {
        fixture.componentInstance.open("2026-11-10", 61500);
        await typeAmount("61000");
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/close");
        expect(text()).toContain("Expliquezl'écartavantdeclôturer.");

        await typeNote("Erreur de monnaie");
        await clickSubmit();
        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body.closingNote).toBe("Erreur de monnaie");
        req.flush({});
    });

    it("should not ask for an explanation when the amount matches", async () => {
        fixture.componentInstance.open("2026-11-10", 61500);
        await typeAmount("61500");

        expect(el.querySelector("textarea")).toBeNull();
    });

    it("should not close the cash register from the starting 0 without typing an amount", async () => {
        fixture.componentInstance.open("2026-11-10", 1000);
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/close");
        expect(el.querySelector('[role="alert"]')?.textContent).toContain("Saisissez le montant");
    });

    it("should not send an explanation written before the amount was corrected", async () => {
        fixture.componentInstance.open("2026-11-10", 1000);
        await typeAmount("500");
        await typeNote("Erreur");
        await typeAmount("1000");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body.closingNote).toBe("");
        req.flush({});
    });

    it("should hide the expected balance and the gap when closing blind", async () => {
        fixture.componentInstance.open("2026-11-10", null);
        await typeAmount("1000");

        expect(text()).not.toContain("Soldeattendu");
        expect(text()).not.toContain("Ilmanque");
        expect(el.querySelector("textarea")).toBeNull();
    });

    it("should reveal the gap after a blind closing and ask for its explanation", async () => {
        const closed = vi.fn();
        fixture.componentInstance.closed.subscribe(closed);
        fixture.componentInstance.open("2026-11-10", null);
        await typeAmount("9000");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_sessions/close")
            .flush({ id: 4, difference: "-500.00", explanation_pending: true });
        await fixture.whenStable();

        // la caisse est déjà clôturée : la page se recharge, le dialogue reste ouvert
        expect(closed).toHaveBeenCalledTimes(1);
        expect(dialog.open).toBe(true);
        expect(text()).toContain("Ilmanquait500Fdansletiroir.");
        expect(el.querySelector('input[type="number"]')).toBeNull();

        await clickSubmit();
        httpMock.expectNone("/api/cash_sessions/4/closing-note");
        expect(text()).toContain("Expliquezl'écartconstaté.");

        await typeNote("Erreur de monnaie");
        await clickSubmit();
        const req = httpMock.expectOne("/api/cash_sessions/4/closing-note");
        expect(req.request.body).toEqual({ closingNote: "Erreur de monnaie" });
        req.flush({});
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
        expect(closed).toHaveBeenCalledTimes(2);
    });

    it("should close directly after a blind closing without gap", async () => {
        fixture.componentInstance.open("2026-11-10", null);
        await typeAmount("9500");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_sessions/close")
            .flush({ id: 4, difference: "0.00", explanation_pending: false });
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
    });

    it("should open straight on the explanation of a pending gap", async () => {
        fixture.componentInstance.openExplain(3, 200);
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(text()).toContain("Ilyavait200Fdeplusqueprévu");
    });

    it("should refuse a negative amount without calling the API", async () => {
        fixture.componentInstance.open("2026-11-10", 1000);
        await typeAmount("-5");
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/close");
        expect(text()).toContain("Lemontantdoitêtrepositifounul.");
    });

    it("should keep the dialog open and show the API error", async () => {
        fixture.componentInstance.open("2026-11-10", 1000);
        await typeAmount("1000");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_sessions/close")
            .flush(
                { message: "Cette session de caisse est déjà fermée." },
                { status: 409, statusText: "Conflict" },
            );
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(el.querySelector('[role="alert"]')?.textContent).toContain("déjà fermée");
    });

    it("should close when clicking the backdrop but not inside the form", async () => {
        fixture.componentInstance.open("2026-11-10", 1000);
        el.querySelector("form")!.click();
        expect(dialog.open).toBe(true);

        dialog.click();
        expect(dialog.open).toBe(false);
    });
});
