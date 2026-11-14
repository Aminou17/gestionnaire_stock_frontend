import { Component, ElementRef, computed, effect, inject, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from "rxjs";

import { AuthService } from "../../core/auth/auth.service";
import { ProductService } from "../../core/stock/product.service";
import { Icon } from "../../shared/icon/icon";
import { IconName } from "../../shared/icon/icons";
import { LayoutService } from "../layout.service";
import { searchablePages } from "../nav-items";

interface Result {
    label: string;
    hint: string;
    icon: IconName;
    link: (string | number)[];
}

const plain = (text: string) =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

// Recherche rapide (Ctrl+K) : pages du menu et produits
@Component({
    selector: "app-search",
    imports: [Icon],
    templateUrl: "./search.html",
    styleUrl: "./search.css",
    host: { "(document:keydown)": "onKey($event)" },
})
export class Search {
    private router = inject(Router);
    private auth = inject(AuthService);
    private products = inject(ProductService);
    protected layout = inject(LayoutService);

    private input = viewChild<ElementRef<HTMLInputElement>>("input");

    query = signal("");
    active = signal(0);
    private foundProducts = signal<Result[]>([]);

    results = computed<Result[]>(() => {
        const text = plain(this.query().trim());
        const pages = searchablePages(this.auth.isAdmin())
            .filter((page) => plain(page.label).includes(text))
            .slice(0, text ? 6 : 8)
            .map((page) => ({
                label: page.label,
                hint: page.hint,
                icon: page.icon,
                link: [page.path],
            }));
        return [...pages, ...this.foundProducts()];
    });

    constructor() {
        toObservable(this.query)
            .pipe(
                debounceTime(250),
                distinctUntilChanged(),
                switchMap((text) =>
                    text.trim().length < 2
                        ? of([])
                        : this.products
                              .getProducts({
                                  search: text.trim(),
                                  categoryId: null,
                                  stockStatus: null,
                                  status: "active",
                                  page: 1,
                                  limit: 5,
                              })
                              .pipe(
                                  map((page) => page.data),
                                  catchError(() => of([])),
                              ),
                ),
                takeUntilDestroyed(),
            )
            .subscribe((list) =>
                this.foundProducts.set(
                    list.map((product) => ({
                        label: product.name,
                        hint: `Produit · ${product.theoretical_stock} en stock`,
                        icon: "package" as const,
                        link: ["/products", product.id],
                    })),
                ),
            );

        effect(() => {
            if (this.layout.searchOpen()) {
                this.query.set("");
                this.active.set(0);
                setTimeout(() => this.input()?.nativeElement.focus());
            }
        });
    }

    onInput(value: string) {
        this.query.set(value);
        this.active.set(0);
    }

    close() {
        this.layout.searchOpen.set(false);
    }

    open(result: Result) {
        this.close();
        this.router.navigate(result.link);
    }

    onKey(event: KeyboardEvent) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            this.layout.searchOpen.update((value) => !value);
            return;
        }
        if (!this.layout.searchOpen()) return;

        const count = this.results().length;
        if (event.key === "Escape") {
            this.close();
        } else if (event.key === "ArrowDown" && count > 0) {
            event.preventDefault();
            this.active.update((i) => (i + 1) % count);
        } else if (event.key === "ArrowUp" && count > 0) {
            event.preventDefault();
            this.active.update((i) => (i - 1 + count) % count);
        } else if (event.key === "Enter" && count > 0) {
            event.preventDefault();
            this.open(this.results()[this.active()]);
        }
    }
}
