import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { CountCashDialog } from "./count-cash-dialog";

describe("CountCashDialog", () => {
    let fixture: ComponentFixture<CountCashDialog>;
    let el: HTMLElement;
    let httpMock: HttpTestingController;
    let dialog: HTMLDialogElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CountCashDialog],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(CountCashDialog);
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
        const input = el.querySelector<HTMLInputElement>("input[type=number]")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function typeReason(value: string) {
        const input = el.querySelector<HTMLInputElement>("input[type=text]")!;
        input.value = value;
        input.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function clickSubmit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    const countedSession = (difference: string) => ({
        id: 1,
        status: "CLOSED",
        theoretical_amount: "61500.00",
        actual_amount: "61000.00",
        difference,
    });

    it("should count today's cash with just the amount and notify", async () => {
        const counted = vi.fn();
        fixture.componentInstance.counted.subscribe(counted);
        fixture.componentInstance.open({ expected: 61500 });
        await typeAmount("61500");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body).toEqual({ actualAmount: 61500 });
        req.flush(countedSession("0.00"));
        await fixture.whenStable();

        expect(counted).toHaveBeenCalled();
    });

    it("should send the session id and the optional reason", async () => {
        fixture.componentInstance.open({ expected: 9000, sessionId: 7, sessionDate: "2026-11-22" });
        await typeAmount("8500");
        await typeReason("Monnaie rendue en trop");
        await clickSubmit();

        const req = httpMock.expectOne("/api/cash_sessions/close");
        expect(req.request.body).toEqual({
            actualAmount: 8500,
            closingNote: "Monnaie rendue en trop",
            sessionId: 7,
        });
        req.flush(countedSession("-500.00"));
    });

    it("should never ask for a reason: a gap does not block the counting", async () => {
        fixture.componentInstance.open({ expected: 61500 });
        await typeAmount("61000");
        await clickSubmit();

        httpMock.expectOne("/api/cash_sessions/close").flush(countedSession("-500.00"));
    });

    it("should tell how much is missing or in excess before saving", async () => {
        fixture.componentInstance.open({ expected: 61500 });
        await fixture.whenStable();
        expect(text()).toContain("Attendudansletiroir61500F");

        await typeAmount("61000");
        expect(text()).toContain("Ilmanque500F.");

        await typeAmount("62000");
        expect(text()).toContain("500Fdeplusqueprévu.");

        await typeAmount("61500");
        expect(text()).toContain("correspondausoldeattendu");
    });

    it("should show the gap in the same dialog right after the counting", async () => {
        fixture.componentInstance.open({ expected: null });
        await typeAmount("61000");
        await clickSubmit();

        httpMock.expectOne("/api/cash_sessions/close").flush(countedSession("-500.00"));
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(text()).toContain("Caissecomptée");
        expect(text()).toContain("Ilmanque500Fdansletiroir.");
        expect(text()).toContain("Attendu61500F");
        expect(text()).toContain("Compté61000F");
        expect(el.querySelector("input")).toBeNull();
    });

    it("should say there is no gap when the drawer matches", async () => {
        fixture.componentInstance.open({ expected: 61500 });
        await typeAmount("61500");
        await clickSubmit();

        httpMock.expectOne("/api/cash_sessions/close").flush(countedSession("0.00"));
        await fixture.whenStable();

        expect(text()).toContain("Aucunécart");
    });

    it("should hide the expected amount and the gap when counting blind", async () => {
        fixture.componentInstance.open({ expected: null });
        await typeAmount("1000");

        expect(text()).not.toContain("Attendudansletiroir");
        expect(text()).not.toContain("Ilmanque");
    });

    it("should name the day when counting a past session", async () => {
        fixture.componentInstance.open({ expected: 9000, sessionId: 7, sessionDate: "2026-11-22" });
        await fixture.whenStable();

        expect(el.textContent).toMatch(/Caisse du .*22/);
    });

    it("should start with an empty amount field, not a 0 to erase", async () => {
        fixture.componentInstance.open({ expected: 1000 });
        await fixture.whenStable();

        expect(el.querySelector<HTMLInputElement>("input[type=number]")?.value).toBe("");
    });

    it("should not count without typing an amount", async () => {
        fixture.componentInstance.open({ expected: 1000 });
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/close");
        expect(el.querySelector('[role="alert"]')?.textContent).toContain("Saisissez un montant");
    });

    it("should refuse a negative amount without calling the API", async () => {
        fixture.componentInstance.open({ expected: 1000 });
        await typeAmount("-5");
        await clickSubmit();

        httpMock.expectNone("/api/cash_sessions/close");
        expect(text()).toContain("Saisissezunmontantentier");
    });

    it("should keep the dialog open and show the API error", async () => {
        fixture.componentInstance.open({ expected: 1000 });
        await typeAmount("1000");
        await clickSubmit();

        httpMock
            .expectOne("/api/cash_sessions/close")
            .flush(
                { message: "Cette caisse est déjà comptée." },
                { status: 403, statusText: "Forbidden" },
            );
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(el.querySelector('[role="alert"]')?.textContent).toContain("déjà comptée");
    });

    it("should close when clicking the backdrop but not inside the form", async () => {
        fixture.componentInstance.open({ expected: 1000 });
        el.querySelector("form")!.click();
        expect(dialog.open).toBe(true);

        dialog.click();
        expect(dialog.open).toBe(false);
    });
});
