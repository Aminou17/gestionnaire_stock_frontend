import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { ReopenCashDialog } from "./reopen-cash-dialog";

describe("ReopenCashDialog", () => {
    let fixture: ComponentFixture<ReopenCashDialog>;
    let el: HTMLElement;
    let httpMock: HttpTestingController;
    let dialog: HTMLDialogElement;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ReopenCashDialog],
            providers: [provideHttpClient(), provideHttpClientTesting()],
        }).compileComponents();

        fixture = TestBed.createComponent(ReopenCashDialog);
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
        fixture.componentInstance.open(7);
    });

    afterEach(() => httpMock.verify());

    async function typeReason(value: string) {
        const field = el.querySelector<HTMLTextAreaElement>("textarea")!;
        field.value = value;
        field.dispatchEvent(new Event("input"));
        await fixture.whenStable();
    }

    async function submit() {
        el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();
    }

    it("should refuse a reason that is too short without calling the API", async () => {
        await typeReason("ok");
        await submit();

        httpMock.expectNone("/api/cash_sessions/7/reopen");
        expect(el.textContent).toContain("5 caractères minimum");
    });

    it("should reopen the session with the reason, then close and notify", async () => {
        const reopened = vi.fn();
        fixture.componentInstance.reopened.subscribe(reopened);

        await typeReason("  erreur de comptage des pièces ");
        await submit();

        const req = httpMock.expectOne("/api/cash_sessions/7/reopen");
        expect(req.request.method).toBe("POST");
        expect(req.request.body).toEqual({ reason: "erreur de comptage des pièces" });
        req.flush({ id: 7 });
        await fixture.whenStable();

        expect(dialog.open).toBe(false);
        expect(reopened).toHaveBeenCalled();
    });

    it("should keep the dialog open and show the API error", async () => {
        await typeReason("erreur de comptage");
        await submit();

        httpMock
            .expectOne("/api/cash_sessions/7/reopen")
            .flush(
                { message: "Une caisse plus récente existe." },
                { status: 409, statusText: "Conflict" },
            );
        await fixture.whenStable();

        expect(dialog.open).toBe(true);
        expect(el.textContent).toContain("Une caisse plus récente existe.");
    });
});
