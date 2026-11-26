import { signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";

import { Pagination, clientPaging, pageItems } from "./pagination";

describe("pageItems", () => {
    it("should show every page when there are few", () => {
        expect(pageItems(1, 1)).toEqual([1]);
        expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
    });

    it("should put ellipses between far pages", () => {
        expect(pageItems(1, 10)).toEqual([1, 2, null, 10]);
        expect(pageItems(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
        expect(pageItems(10, 10)).toEqual([1, null, 9, 10]);
    });

    it("should fill a gap of a single page instead of an ellipsis", () => {
        expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, null, 10]);
    });
});

describe("Pagination", () => {
    let fixture: ComponentFixture<Pagination>;
    let el: HTMLElement;

    const text = (selector: string) => el.querySelector(selector)?.textContent?.trim();
    const button = (selector: string) => el.querySelector<HTMLButtonElement>(selector)!;

    const setup = async (total: number, page = 1, pageSize = 25) => {
        fixture.componentRef.setInput("total", total);
        fixture.componentRef.setInput("page", page);
        fixture.componentRef.setInput("pageSize", pageSize);
        await fixture.whenStable();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({ imports: [Pagination] }).compileComponents();
        fixture = TestBed.createComponent(Pagination);
        el = fixture.nativeElement;
    });

    it("should stay hidden when everything fits the smallest page", async () => {
        await setup(8);
        expect(el.querySelector("nav")).toBeNull();
    });

    it("should show the range and the page count", async () => {
        await setup(248, 2);
        // L'écran ne montre que les numéros ; le détail est pour les lecteurs d'écran
        expect(text(".sr-only")).toBe("Page 2 sur 10, 26 à 50 sur 248");
        expect(el.querySelector(".range")).toBeNull();
        expect(el.querySelector("nav")?.getAttribute("aria-label")).toBe("Pagination");
    });

    it("should disable Précédent on the first page and Suivant on the last", async () => {
        await setup(60, 1);
        expect(button(".prev").disabled).toBe(true);
        expect(button(".next").disabled).toBe(false);

        await setup(60, 3);
        expect(button(".prev").disabled).toBe(false);
        expect(button(".next").disabled).toBe(true);
        expect(text(".sr-only")).toContain("51 à 60 sur 60");
    });

    it("should go to the next page and mark the current number", async () => {
        await setup(100, 1);
        button(".next").click();
        await fixture.whenStable();

        expect(fixture.componentInstance.page()).toBe(2);
        expect(el.querySelector(".num[aria-current='page']")?.textContent?.trim()).toBe("2");
    });

    it("should go to a numbered page", async () => {
        await setup(100, 1);
        button(".num[aria-label='Page 3']").click();
        expect(fixture.componentInstance.page()).toBe(3);
    });

    it("should fall back to the last page when the list shrinks", async () => {
        await setup(100, 4);
        await setup(60, 4);
        expect(fixture.componentInstance.page()).toBe(3);
    });
});

describe("clientPaging", () => {
    it("should slice the list and go back to page 1 when the reset key changes", () => {
        TestBed.runInInjectionContext(() => {
            const items = signal(Array.from({ length: 60 }, (_, i) => i));
            const filter = signal("a");
            const paging = clientPaging(
                () => items(),
                "test-list",
                () => filter(),
            );

            expect(paging.total()).toBe(60);
            expect(paging.visible().length).toBe(25);

            paging.page.set(3);
            expect(paging.visible()).toEqual(items().slice(50));

            filter.set("b");
            expect(paging.page()).toBe(1);
        });
    });
});
