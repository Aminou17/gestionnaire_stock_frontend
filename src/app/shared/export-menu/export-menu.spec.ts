import { ComponentFixture, TestBed } from "@angular/core/testing";

import { ExportFormat } from "../../core/export-format";
import { ExportMenu } from "./export-menu";

describe("ExportMenu", () => {
    let fixture: ComponentFixture<ExportMenu>;
    let el: HTMLElement;
    let picked: ExportFormat[];

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [ExportMenu] }).compileComponents();
        fixture = TestBed.createComponent(ExportMenu);
        el = fixture.nativeElement;
        picked = [];
        fixture.componentInstance.picked.subscribe((f) => picked.push(f));
        await fixture.whenStable();
    });

    const trigger = () => el.querySelector<HTMLButtonElement>(".trigger")!;
    const items = () => [...el.querySelectorAll<HTMLButtonElement>(".item")];
    const panel = () => el.querySelector<HTMLElement>(".panel")!;

    it("should offer the pdf and the csv", () => {
        expect(items().map((i) => i.textContent?.replace(/\s+/g, " ").trim())).toEqual([
            "PDF pour imprimer",
            "CSV pour Excel",
        ]);
        expect(panel().hasAttribute("popover")).toBe(true);
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });

    it("should open the popover when the button is pressed", () => {
        // jsdom ne connaît pas l'API popover
        panel().showPopover = vi.fn();

        trigger().click();
        fixture.detectChanges();

        expect(panel().showPopover).toHaveBeenCalled();
        expect(trigger().getAttribute("aria-expanded")).toBe("true");
    });

    it("should follow the browser when it closes the popover", () => {
        trigger().click();
        fixture.detectChanges();

        const event = new Event("toggle");
        Object.assign(event, { newState: "closed" });
        panel().dispatchEvent(event);
        fixture.detectChanges();

        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });

    it("should send the chosen format and close", () => {
        panel().hidePopover = vi.fn();
        trigger().click();
        fixture.detectChanges();

        items()[1].click();
        fixture.detectChanges();

        expect(picked).toEqual(["csv"]);
        expect(panel().hidePopover).toHaveBeenCalled();
        expect(trigger().getAttribute("aria-expanded")).toBe("false");
    });

    it("should be disabled while a file is being prepared", async () => {
        fixture.componentRef.setInput("busy", true);
        await fixture.whenStable();

        expect(trigger().disabled).toBe(true);
        expect(el.querySelector(".spinner")).not.toBeNull();
    });
});
