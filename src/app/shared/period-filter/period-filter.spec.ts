import { ComponentFixture, TestBed } from "@angular/core/testing";

import { PeriodFilter, PeriodRange, validateRange } from "./period-filter";

describe("PeriodFilter", () => {
    let fixture: ComponentFixture<PeriodFilter>;
    let el: HTMLElement;
    let emitted: PeriodRange[];

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [PeriodFilter] }).compileComponents();
        fixture = TestBed.createComponent(PeriodFilter);
        el = fixture.nativeElement;
        emitted = [];
        fixture.componentInstance.changed.subscribe((range) => emitted.push(range));
        await fixture.whenStable();
    });

    async function select(value: string) {
        const select = el.querySelector<HTMLSelectElement>("select")!;
        select.value = value;
        select.dispatchEvent(new Event("change"));
        await fixture.whenStable();
    }

    it("should send today's dates for today and no dates for all", async () => {
        await select("today");
        expect(emitted[0].from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(emitted[0].from).toBe(emitted[0].to);

        await select("all");
        expect(emitted[1]).toEqual({ period: "all", from: null, to: null });
    });

    it("should prefill a custom period and only send valid ones", async () => {
        await select("custom");
        const [from, to] = el.querySelectorAll<HTMLInputElement>(".custom-range input");
        expect(emitted[0]).toEqual({ period: "custom", from: from.value, to: to.value });

        from.value = "2026-11-10";
        to.value = "2026-11-01";
        to.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(el.textContent).toContain("La date de début doit précéder la date de fin.");
        expect(emitted.length).toBe(1);

        to.value = "2026-11-10";
        to.dispatchEvent(new Event("change"));
        await fixture.whenStable();
        expect(emitted.at(-1)).toEqual({ period: "custom", from: "2026-11-10", to: "2026-11-10" });
    });
});

describe("validateRange", () => {
    const today = "2026-11-11";

    it("should require both dates, refuse the future and a start after the end", () => {
        expect(validateRange("", "2026-11-05", today)).toBe(
            "Choisissez une date de début et une date de fin.",
        );
        expect(validateRange("2026-11-01", "2026-11-12", today)).toBe(
            "Une date ne peut pas être dans le futur.",
        );
        expect(validateRange("2026-11-05", "2026-11-01", today)).toBe(
            "La date de début doit précéder la date de fin.",
        );
        expect(validateRange("2026-11-05", "2026-11-05", today)).toBeNull();
    });
});
