import { HttpErrorResponse } from "@angular/common/http";
import { DatePipe } from "@angular/common";
import {
    Component,
    DestroyRef,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    inject,
    signal,
} from "@angular/core";
import { rxResource, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { AuthService } from "../../core/auth/auth.service";
import { BackState } from "../../core/back-link";
import { LowStockAlert, SnoozeDays } from "../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../core/stock/low-stock-alert.service";
import { ProductService } from "../../core/stock/product.service";
import { PageHeader } from "../../layout/page-header/page-header";
import { Icon } from "../../shared/icon/icon";
import { DaysLeftPipe } from "../../shared/pipes/days-left.pipe";

type View = "all" | "out" | "low";

const normalize = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

interface AlertGroup {
    key: string;
    name: string;
    contact: string | null;
    phone: string | null;
    items: LowStockAlert[];
}

@Component({
    selector: "app-alerts",
    imports: [RouterLink, DatePipe, PageHeader, Icon, DaysLeftPipe],
    templateUrl: "./alerts.html",
    styleUrl: "./alerts.css",
    host: {
        "(document:click)": "closeMenuOutside($event)",
        "(document:keydown.escape)": "escapeMenu()",
    },
})
export class Alerts {
    private alertService = inject(LowStockAlertService);
    private productService = inject(ProductService);
    private destroyRef = inject(DestroyRef);
    private injector = inject(Injector);
    private host = inject<ElementRef<HTMLElement>>(ElementRef);
    private router = inject(Router);
    private params = inject(ActivatedRoute).snapshot.queryParamMap;
    protected auth = inject(AuthService);

    // même requête que la cloche et la sidebar
    alerts = this.alertService.alerts;
    all = computed(() => (this.alerts.hasValue() ? this.alerts.value() : []));

    private rotation = rxResource({ stream: () => this.alertService.getRotation() });
    toClearCount = computed(() =>
        this.rotation.hasValue() ? this.rotation.value().filter((p) => p.to_clear).length : 0,
    );

    // onglet et filtres reviennent tels quels quand on revient d'une fiche produit
    view = signal<View>(
        this.params.get("vue") === "out" || this.params.get("vue") === "low"
            ? (this.params.get("vue") as View)
            : "all",
    );
    search = signal(this.params.get("q") ?? "");
    supplierId = signal(this.params.get("fournisseur") ?? "");
    categoryId = signal(this.params.get("categorie") ?? "");
    // sur téléphone les deux listes de filtres restent repliées derrière un bouton
    filtersOpen = signal(false);
    // un seul menu ouvert à la fois : "g" + fournisseur ou "r" + produit
    openMenu = signal<string | null>(null);

    // modification du seuil et sourdine directement dans la ligne
    editingId = signal<number | null>(null);
    editValue = signal("");
    busyId = signal<number | null>(null);
    rowError = signal<string | null>(null);
    snoozed = this.alertService.snoozedList;
    snoozeOptions: SnoozeDays[] = [7, 30, 90];
    // la ligne disparaît tout de suite : on laisse un moyen d'annuler une erreur de choix
    snoozedNotice = signal<{ id: number; name: string; days: SnoozeDays } | null>(null);

    suppliers = computed(() =>
        this.options(this.all().map((a) => [a.supplier_id, a.supplier_name])),
    );
    categories = computed(() =>
        this.options(this.all().map((a) => [a.category_id, a.category_name])),
    );

    filtered = computed(() => {
        const text = normalize(this.search());
        const supplierId = this.supplierId();
        const categoryId = this.categoryId();

        return this.all().filter(
            (a) =>
                (!text || normalize(a.name).includes(text)) &&
                (!supplierId || String(a.supplier_id) === supplierId) &&
                (!categoryId || String(a.category_id) === categoryId),
        );
    });

    outCount = computed(() => this.all().filter((a) => a.status === "OUT_OF_STOCK").length);
    lowCount = computed(() => this.all().length - this.outCount());

    list = computed(() => {
        const view = this.view();
        if (view === "all") return this.filtered();
        return this.filtered().filter((a) => (a.status === "OUT_OF_STOCK") === (view === "out"));
    });

    // un bloc par fournisseur, le plus urgent en premier ; les produits sans fournisseur à la fin
    groups = computed(() => {
        const byKey = new Map<string, AlertGroup>();
        for (const alert of this.list()) {
            const key = alert.supplier_id === null ? "none" : String(alert.supplier_id);
            const group = byKey.get(key) ?? {
                key,
                name: alert.supplier_name ?? "Sans fournisseur",
                contact: alert.supplier_contact,
                phone: alert.supplier_phone,
                items: [],
            };
            group.items.push(alert);
            byKey.set(key, group);
        }
        const groups = [...byKey.values()];
        return [
            ...groups.filter((g) => g.key !== "none"),
            ...groups.filter((g) => g.key === "none"),
        ];
    });

    // la fiche produit ouverte sait ainsi revenir ici, avec le même onglet et les mêmes filtres
    backState = computed<BackState>(() => {
        const queryParams = {
            vue: this.view() === "all" ? null : this.view(),
            q: this.search() || null,
            fournisseur: this.supplierId() || null,
            categorie: this.categoryId() || null,
        };
        const url = this.router.createUrlTree(["/alerts"], { queryParams });
        return { backTo: this.router.serializeUrl(url), backLabel: "Alertes" };
    });

    activeFilters = computed(() => (this.supplierId() ? 1 : 0) + (this.categoryId() ? 1 : 0));

    hasFilter = computed(() => !!(this.search() || this.supplierId() || this.categoryId()));

    private error = computed(() => this.alerts.error() as HttpErrorResponse | undefined);

    // le backend répond 409 tant que le seuil général n'est pas réglé
    needsSettings = computed(() => this.error()?.status === 409);

    // un second clic sur la tuile active enlève le filtre
    toggleView(view: View) {
        this.view.set(this.view() === view ? "all" : view);
    }

    private menuTrigger: HTMLElement | null = null;

    toggleMenu(key: string, trigger: HTMLElement) {
        if (this.openMenu() === key) return this.closeMenu();

        this.menuTrigger = trigger;
        this.openMenu.set(key);
        // le clavier arrive directement dans le menu
        afterNextRender(
            () =>
                this.host.nativeElement
                    .querySelector<HTMLElement>(".menu-panel .menu-item")
                    ?.focus(),
            { injector: this.injector },
        );
    }

    // Échap rend le focus au bouton qui avait ouvert le menu
    escapeMenu() {
        if (this.openMenu() === null) return;
        this.closeMenu();
        this.menuTrigger?.focus();
    }

    closeMenu() {
        this.openMenu.set(null);
    }

    closeMenuOutside(event: Event) {
        if (!(event.target as Element).closest(".menu-wrap")) this.closeMenu();
    }

    lastEntryLabel(alert: LowStockAlert) {
        if (!alert.last_entry_at) return "Jamais réapprovisionné";

        const days = Math.floor(
            (Date.now() - new Date(alert.last_entry_at).getTime()) / 86_400_000,
        );
        const when = days <= 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} jours`;
        return `${when} (+${alert.last_entry_quantity})`;
    }

    editThreshold(id: number, current: number) {
        this.rowError.set(null);
        this.editingId.set(id);
        this.editValue.set(String(current));
        // autofocus ne marche pas sur un champ ajouté après coup
        afterNextRender(
            () =>
                this.host.nativeElement
                    .querySelector<HTMLInputElement>(".threshold-input")
                    ?.focus(),
            { injector: this.injector },
        );
    }

    cancelEdit() {
        this.editingId.set(null);
    }

    saveThreshold(id: number) {
        // Entrée puis la perte de focus déclenchent deux appels : on ne garde que le premier
        if (this.editingId() !== id || this.busyId() !== null) return;

        const value = this.editValue().trim();
        const minStock = Number(value);

        if (value === "" || !Number.isInteger(minStock) || minStock < 0) {
            this.rowError.set("Le seuil doit être un nombre entier, 0 ou plus.");
            return;
        }

        // valeur inchangée : pas d'appel inutile
        if (this.all().find((a) => a.id === id)?.min_stock === minStock) {
            this.editingId.set(null);
            return;
        }

        this.busyId.set(id);
        this.rowError.set(null);

        this.productService
            .updateProduct(id, { minStock })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busyId.set(null);
                    this.editingId.set(null);
                    this.alertService.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.busyId.set(null);
                    this.rowError.set(err.error?.message ?? "Impossible de modifier le seuil.");
                },
            });
    }

    snooze(alert: LowStockAlert, days: SnoozeDays) {
        this.closeMenu();
        this.changeSnooze(alert.id, days, () =>
            this.snoozedNotice.set({ id: alert.id, name: alert.name, days }),
        );
    }

    resume(id: number) {
        this.changeSnooze(id, null, () => this.snoozedNotice.set(null));
    }

    private changeSnooze(id: number, days: SnoozeDays | null, done: () => void) {
        this.busyId.set(id);
        this.rowError.set(null);

        this.alertService
            .snooze(id, days)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.busyId.set(null);
                    done();
                    this.alertService.reload();
                },
                error: (err: HttpErrorResponse) => {
                    this.busyId.set(null);
                    this.rowError.set(err.error?.message ?? "Impossible de modifier l'alerte.");
                },
            });
    }

    resetFilters() {
        this.search.set("");
        this.supplierId.set("");
        this.categoryId.set("");
        this.filtersOpen.set(false);
    }

    // les produits sans fournisseur ou sans catégorie n'ont pas d'entrée dans la liste
    private options(pairs: (number | string | null)[][]) {
        const seen = new Map<number, string>();
        for (const [id, name] of pairs) {
            if (id !== null && name) seen.set(Number(id), String(name));
        }
        return [...seen]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    }

    errorMessage = computed(
        () => this.error()?.error?.message ?? "Impossible de charger les alertes.",
    );
}
