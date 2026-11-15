import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { ActionItem, ActionMenu } from "./action-menu";

describe("ActionMenu", () => {
    let fixture: ComponentFixture<ActionMenu>;
    let el: HTMLElement;
    let picked: string[];

    const items: ActionItem[] = [
        { id: "edit", label: "Modifier", icon: "edit" },
        { id: "delete", label: "Supprimer", icon: "trash", danger: true },
    ];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ActionMenu],
            providers: [provideRouter([])],
        }).compileComponents();
        fixture = TestBed.createComponent(ActionMenu);
        el = fixture.nativeElement;
        picked = [];
        fixture.componentRef.setInput("items", items);
        fixture.componentRef.setInput("label", "Actions pour Awa");
        fixture.componentInstance.picked.subscribe((id) => picked.push(id));
        await fixture.whenStable();
    });

    const trigger = () => el.querySelector<HTMLButtonElement>(".more-btn")!;
    const panel = () => el.querySelector<HTMLElement>(".panel")!;
    const entries = () => [...el.querySelectorAll<HTMLElement>(".item")];

    it("should list the actions in a popover", () => {
        expect(entries().map((i) => i.textContent?.trim())).toEqual(["Modifier", "Supprimer"]);
        expect(panel().hasAttribute("popover")).toBe(true);
        expect(trigger().getAttribute("aria-label")).toBe("Actions pour Awa");
        expect(entries()[1].classList).toContain("danger");
    });

    it("should open the popover when the button is pressed", () => {
        // jsdom ne connaît pas l'API popover
        panel().showPopover = vi.fn();

        trigger().click();
        fixture.detectChanges();

        expect(panel().showPopover).toHaveBeenCalled();
        expect(trigger().getAttribute("aria-expanded")).toBe("true");
    });

    it("should send the chosen action and close", () => {
        panel().hidePopover = vi.fn();

        entries()[1].click();

        expect(picked).toEqual(["delete"]);
        expect(panel().hidePopover).toHaveBeenCalled();
    });

    it("should not let a click reach the row behind", () => {
        const row = document.createElement("li");
        const onRow = vi.fn();
        row.addEventListener("click", onRow);
        row.appendChild(el);

        trigger().click();
        entries()[0].click();

        expect(onRow).not.toHaveBeenCalled();
    });

    it("should render a link when the action has one", async () => {
        fixture.componentRef.setInput("items", [
            { id: "password", label: "Mon mot de passe", icon: "key", link: "/settings/account" },
        ]);
        await fixture.whenStable();

        expect(el.querySelector("a.item")?.getAttribute("href")).toBe("/settings/account");
    });
});
