import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    input,
    linkedSignal,
    model,
    signal,
} from "@angular/core";

import { Icon } from "../icon/icon";

export const PAGE_SIZES = [10, 25, 50, 100];

// numéros affichés : première et dernière page, la page courante et ses voisines, null pour « … »
export const pageItems = (page: number, pages: number): (number | null)[] => {
    const wanted = new Set([1, pages, page - 1, page, page + 1]);
    const numbers = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

    const items: (number | null)[] = [];
    numbers.forEach((n, i) => {
        const previous = numbers[i - 1];
        if (previous !== undefined && n - previous === 2) items.push(previous + 1);
        else if (previous !== undefined && n - previous > 2) items.push(null);
        items.push(n);
    });
    return items;
};

// taille de page gardée d'une visite à l'autre : à appeler dans un champ du composant
export const storedPageSize = (key: string, fallback = 25) => {
    const storageKey = `page-size-${key}`;
    let initial = fallback;
    try {
        const saved = Number(localStorage.getItem(storageKey));
        if (PAGE_SIZES.includes(saved)) initial = saved;
    } catch {
        // stockage indisponible : on garde la valeur par défaut
    }

    const size = signal(initial);
    effect(() => {
        try {
            localStorage.setItem(storageKey, String(size()));
        } catch {
            // stockage indisponible : rien à garder
        }
    });
    return size;
};

// pagination d'une liste déjà chargée en entier : la page revient à 1 quand `resetOn` change
export const clientPaging = <T>(
    items: () => T[],
    key: string,
    resetOn: () => string | number = () => 0,
) => {
    const pageSize = storedPageSize(key);
    const page = linkedSignal({ source: resetOn, computation: () => 1 });
    const total = computed(() => items().length);
    const visible = computed(() => {
        const start = (page() - 1) * pageSize();
        return items().slice(start, start + pageSize());
    });

    return { page, pageSize, total, visible };
};

@Component({
    selector: "app-pagination",
    imports: [Icon],
    templateUrl: "./pagination.html",
    styleUrl: "./pagination.css",
    host: { "[class.attached]": "attached()" },
})
export class Pagination {
    private host = inject<ElementRef<HTMLElement>>(ElementRef);

    total = input.required<number>();
    page = model.required<number>();
    pageSize = model.required<number>();
    sizes = input<number[]>(PAGE_SIZES);
    // posée au bas d'une carte (ordinateur) : filet au-dessus et marges de carte
    attached = input(false);

    pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
    items = computed(() => pageItems(this.page(), this.pages()));
    first = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1));
    last = computed(() => Math.min(this.total(), this.page() * this.pageSize()));

    // en dessous de la plus petite taille, une seule page : rien à afficher
    visible = computed(() => this.total() > Math.min(...this.sizes()));

    constructor() {
        // une suppression ou un filtre peut laisser la page courante sans élément
        effect(() => {
            if (this.total() > 0 && this.page() > this.pages()) this.page.set(this.pages());
        });
    }

    go(page: number) {
        if (page < 1 || page > this.pages() || page === this.page()) return;

        this.page.set(page);
        this.scrollToList();
    }

    changeSize(value: string) {
        this.pageSize.set(Number(value));
        this.page.set(1);
        this.scrollToList();
    }

    // ramène le haut de la liste à l'écran seulement s'il en est sorti
    private scrollToList() {
        const element = this.host.nativeElement;
        const list = element.closest(".card") ?? element.parentElement ?? element;
        if (list.getBoundingClientRect().top < 0) {
            list.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }
}
