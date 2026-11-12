import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    linkedSignal,
    signal,
    viewChild,
} from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { CashMovementPage, CashMovementRow, CashMovementType } from "../../../core/cash/cash.model";
import { CashMovementService } from "../../../core/cash/cash-movement.service";
import { CASH_REASONS } from "../../../core/cash/cash-reasons";
import { PageHeader } from "../../../layout/page-header/page-header";
import { PeriodFilter, PeriodRange } from "../../../shared/period-filter/period-filter";
import { FcfaPipe } from "../../../shared/pipes/fcfa.pipe";
import { CashMovementList } from "../cash-movement-list/cash-movement-list";

const PAGE_SIZE = 20;

const TYPES: { label: string; value: CashMovementType | null }[] = [
    { label: "Tous", value: null },
    { label: "Ventes", value: "SALE" },
    { label: "Ajouts", value: "DEPOSIT" },
    { label: "Dépenses", value: "EXPENSE" },
    { label: "Retraits", value: "WITHDRAWAL" },
];

// Journal de tous les mouvements de caisse (propriétaire seulement, comme l'API)
@Component({
    selector: "app-cash-movements",
    imports: [PageHeader, PeriodFilter, FcfaPipe, CashMovementList],
    templateUrl: "./cash-movements.html",
    styleUrl: "./cash-movements.css",
})
export class CashMovements {
    private movementService = inject(CashMovementService);

    private sentinel = viewChild<ElementRef<HTMLElement>>("sentinel");

    types = TYPES;
    range = signal<PeriodRange>({ period: "all", from: null, to: null });
    type = signal<CashMovementType | null>(null);
    category = signal<string | null>(null);
    page = signal(1);

    // le motif ne se choisit qu'après le type, car chaque type a sa liste
    reasons = computed(() => {
        const type = this.type();
        return type && type !== "SALE" ? CASH_REASONS[type] : [];
    });

    movements = rxResource({
        params: () => ({
            type: this.type(),
            from: this.range().from,
            to: this.range().to,
            category: this.category(),
            page: this.page(),
            limit: PAGE_SIZE,
        }),
        stream: ({ params }) => this.movementService.getMovements(params),
    });

    // dernière réponse reçue : on la garde pendant le chargement de la suivante
    last = linkedSignal<CashMovementPage | undefined, CashMovementPage | undefined>({
        source: () => (this.movements.hasValue() ? this.movements.value() : undefined),
        computation: (next, previous) => next ?? previous?.value,
    });

    // la page 1 remplace la liste, les suivantes s'ajoutent au bout
    list = linkedSignal<CashMovementPage | undefined, CashMovementRow[]>({
        source: this.last,
        computation: (res, previous) => {
            if (!res) return previous?.value ?? [];
            if (res.pagination.page === 1 || !previous) return res.data;

            const known = new Set(previous.value.map((movement) => movement.id));
            return [...previous.value, ...res.data.filter((m) => !known.has(m.id))];
        },
    });

    total = computed(() => this.last()?.pagination.total ?? 0);
    summary = computed(() => this.last()?.summary);
    // les squelettes remplacent aussi l'ancienne liste quand on change de filtre
    firstLoad = computed(() => this.movements.isLoading() && (!this.last() || this.page() === 1));
    // d'après le nombre de pages : une page qui n'apporte rien de nouveau ne relance pas le chargement
    hasMore = computed(() => this.page() < (this.last()?.pagination.totalPages ?? 0));
    loadingMore = computed(() => this.movements.isLoading() && this.page() > 1);

    constructor() {
        // charger la page suivante quand le bas de la liste devient visible
        effect((onCleanup) => {
            this.list();
            const sentinel = this.sentinel()?.nativeElement;
            if (!sentinel) return;

            const observer = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting && this.hasMore() && !this.movements.isLoading()) {
                        this.page.update((page) => page + 1);
                    }
                },
                { rootMargin: "200px" },
            );
            observer.observe(sentinel);
            onCleanup(() => observer.disconnect());
        });
    }

    selectRange(range: PeriodRange) {
        this.range.set(range);
        this.page.set(1);
    }

    selectType(value: CashMovementType | null) {
        this.type.set(value);
        this.category.set(null);
        this.page.set(1);
    }

    selectCategory(value: string) {
        this.category.set(value || null);
        this.page.set(1);
    }
}
