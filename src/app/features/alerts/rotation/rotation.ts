import { Component, computed, inject, signal } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { BackState, getBackLink } from "../../../core/back-link";
import { ProductRotation, RotationSpeed } from "../../../core/stock/low-stock-alert.model";
import { LowStockAlertService } from "../../../core/stock/low-stock-alert.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";
import { Pagination, clientPaging } from "../../../shared/pagination/pagination";
import { PhotoZoom } from "../../../shared/photo-zoom/photo-zoom";
import { DaysLeftPipe } from "../../../shared/pipes/days-left.pipe";
import { categoryTone, productInitials } from "../../products/product-look";

// CLEAR : en stock et sans vente depuis 60 jours, à solder
type View = "all" | RotationSpeed | "CLEAR";

// un produit qui sort vite avec moins de 14 jours de stock est à surveiller
const URGENT_DAYS = 14;

// valeurs de ?vue= : la page Alertes envoie ici avec solder, et la fiche produit y revient avec la vue ouverte
const viewParams: Record<string, View> = {
    vite: "FAST",
    normal: "NORMAL",
    lent: "SLOW",
    inactifs: "DORMANT",
    solder: "CLEAR",
};
const viewFromParam = (value: string | null): View => (value && viewParams[value]) || "all";

const labels: Record<RotationSpeed, string> = {
    FAST: "Sort vite",
    NORMAL: "Normal",
    SLOW: "Sort lentement",
    DORMANT: "Ne bouge pas",
};

const speeds: RotationSpeed[] = ["FAST", "NORMAL", "SLOW", "DORMANT"];

@Component({
    selector: "app-rotation",
    imports: [RouterLink, PageHeader, Icon, PhotoZoom, DaysLeftPipe, Pagination],
    host: { "(document:keydown.escape)": "filtersOpen.set(false)" },
    templateUrl: "./rotation.html",
    styleUrl: "./rotation.css",
})
export class Rotation {
    protected back = getBackLink("/alerts", "Retour aux alertes");
    private alertService = inject(LowStockAlertService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    rotation = rxResource({
        stream: () => this.alertService.getRotation(),
    });

    all = computed(() => (this.rotation.hasValue() ? this.rotation.value() : []));
    view = signal<View>(viewFromParam(this.route.snapshot.queryParamMap.get("vue")));

    tabs: { value: View; label: string }[] = [
        { value: "all", label: "Tous" },
        { value: "FAST", label: "Vite" },
        { value: "NORMAL", label: "Normal" },
        { value: "SLOW", label: "Lent" },
        { value: "DORMANT", label: "Inactifs" },
        { value: "CLEAR", label: "À solder" },
    ];

    filtersOpen = signal(false);
    explainOpen = signal(false);
    zoom = signal<{ src: string; name: string } | null>(null);
    initials = productInitials;

    // la fiche produit ouverte sait ainsi revenir ici, sur le même onglet
    backState = computed<BackState>(() => {
        const vue = Object.keys(viewParams).find((key) => viewParams[key] === this.view());
        const url = this.router.createUrlTree(["/alerts/rotation"], {
            queryParams: { vue: vue ?? null },
        });
        return { backTo: this.router.serializeUrl(url), backLabel: "Rotation" };
    });

    list = computed(() => this.filter(this.view()));

    paging = clientPaging(
        () => this.list(),
        "rotation",
        () => this.view(),
    );

    emptyMessage = computed(() =>
        this.view() === "CLEAR"
            ? "Rien à solder : chaque produit en stock s'est vendu ces 60 derniers jours."
            : "Aucun produit dans cette catégorie.",
    );

    urgentCount = computed(
        () =>
            this.all().filter(
                (p) => p.speed === "FAST" && p.days_left !== null && p.days_left < URGENT_DAYS,
            ).length,
    );

    count(view: View) {
        return this.filter(view).length;
    }

    private filter(view: View) {
        if (view === "all") return this.all();
        if (view === "CLEAR") return this.all().filter((p) => p.to_clear);
        return this.all().filter((p) => p.speed === view);
    }

    idleLabel(product: ProductRotation) {
        const days = product.idle_days ?? 0;
        if (product.last_sale_at === null) {
            return days === 0 ? "Jamais vendu" : `Jamais vendu, en rayon depuis ${days} j`;
        }
        return days === 0 ? "Dernière vente aujourd'hui" : `Dernière vente il y a ${days} j`;
    }

    tone(product: ProductRotation) {
        return categoryTone(product.category_name ?? product.name);
    }

    zoomImage(event: Event, product: ProductRotation) {
        event.stopPropagation();
        if (product.image) this.zoom.set({ src: product.image, name: product.name });
    }

    // la barre de répartition : la part de chaque vitesse parmi tous les produits
    shares = computed(() => {
        const total = this.all().length || 1;
        return speeds.map((speed) => ({
            speed,
            label: labels[speed],
            count: this.count(speed),
            width: (this.count(speed) / total) * 100,
        }));
    });

    splitLabel = computed(() =>
        this.shares()
            .filter((share) => share.count > 0)
            .map((share) => `${share.label} ${share.count}`)
            .join(", "),
    );

    activeLabel = computed(() => this.tabs.find((tab) => tab.value === this.view())?.label);

    select(view: View) {
        this.view.set(view);
    }

    label(speed: RotationSpeed) {
        return labels[speed];
    }

    // jauge de stock restant : pleine à 90 jours et plus
    gaugeWidth(product: ProductRotation) {
        return Math.min(product.days_left ?? 0, 90) / 0.9;
    }

    gaugeTone(product: ProductRotation) {
        const days = product.days_left ?? 0;
        return days < URGENT_DAYS ? "danger" : days < 30 ? "warning" : "success";
    }

    isUrgent(product: ProductRotation) {
        return (
            product.speed === "FAST" &&
            product.days_left !== null &&
            product.days_left < URGENT_DAYS
        );
    }
}
