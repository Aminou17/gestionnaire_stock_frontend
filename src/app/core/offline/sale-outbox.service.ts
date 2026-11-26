import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { DestroyRef, Injectable, computed, effect, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { API_URL } from "../api.config";
import { AuthService } from "../auth/auth.service";
import { NewSaleItem, NewSalePayment } from "../sales/sale.model";
import { ToastService } from "../../shared/toast/toast.service";
import { dbAll, dbDelete, dbSet } from "./local-db";
import { NetworkService } from "./network.service";
import { newRef } from "./new-ref";
import { OfflineCatalogService } from "./offline-catalog.service";

// waiting : en attente du réseau ; error : refusée, à vérifier
export type PendingStatus = "waiting" | "sending" | "error";

export interface PendingSale {
    clientRef: string;
    userId: number;
    soldAt: string;
    items: NewSaleItem[];
    payment: NewSalePayment;
    // De quoi afficher la vente sans le serveur
    summary: {
        total: number;
        lines: { name: string; quantity: number; unitPrice: number }[];
        customer: string | null;
        method: NewSalePayment["paymentMethod"];
    };
    status: PendingStatus;
    error: string | null;
    attempts: number;
}

const RETRY_MS = 30_000;

// Ventes faites sans internet, gardées sur l'appareil et envoyées une par une dès que le serveur répond
@Injectable({ providedIn: "root" })
export class SaleOutboxService {
    private http = inject(HttpClient);
    private auth = inject(AuthService);
    private network = inject(NetworkService);
    private catalog = inject(OfflineCatalogService);
    private toast = inject(ToastService);

    private all = signal<PendingSale[]>([]);
    private syncing = false;

    // Seulement les ventes du compte connecté
    readonly pending = computed(() => {
        const userId = this.auth.user()?.id;
        return this.all()
            .filter((sale) => sale.userId === userId)
            .sort((a, b) => a.soldAt.localeCompare(b.soldAt));
    });
    readonly count = computed(() => this.pending().length);
    readonly needsAttention = computed(
        () => this.pending().filter((sale) => sale.status === "error").length,
    );

    constructor() {
        void this.reload();
        this.catalog.registerPending(() => this.pending().flatMap((sale) => sale.items));

        // Retour du réseau : on envoie tout de suite
        effect(() => {
            if (this.network.online() && this.auth.user()) void this.sync();
        });

        const timer = setInterval(() => {
            if (this.count() > 0 && this.auth.user()) void this.sync();
        }, RETRY_MS);
        inject(DestroyRef).onDestroy(() => clearInterval(timer));
    }

    private async reload() {
        this.all.set(await dbAll<PendingSale>("outbox"));
    }

    private async put(sale: PendingSale) {
        await dbSet("outbox", sale.clientRef, sale);
        this.all.update((list) => [...list.filter((s) => s.clientRef !== sale.clientRef), sale]);
    }

    async add(items: NewSaleItem[], payment: NewSalePayment, summary: PendingSale["summary"]) {
        const userId = this.auth.user()?.id;
        if (!userId) throw new Error("Aucun compte connecté.");

        const sale: PendingSale = {
            clientRef: newRef(),
            userId,
            soldAt: new Date().toISOString(),
            items,
            payment,
            summary,
            status: "waiting",
            error: null,
            attempts: 0,
        };

        await this.put(sale);
        await this.catalog.takeStock(items);
        return sale;
    }

    async remove(clientRef: string) {
        await dbDelete("outbox", clientRef);
        this.all.update((list) => list.filter((sale) => sale.clientRef !== clientRef));
    }

    // Une vente refusée peut être réessayée après correction (produit remis en vente)
    async retry(clientRef: string) {
        const sale = this.all().find((s) => s.clientRef === clientRef);
        if (!sale) return;
        await this.put({ ...sale, status: "waiting", error: null });
        await this.sync();
    }

    async sync() {
        if (this.syncing) return;
        this.syncing = true;
        let sent = 0;

        try {
            for (const sale of this.pending()) {
                // Une vente refusée attend qu'on la vérifie ;
                if (sale.status === "error") continue;

                await this.put({ ...sale, status: "sending" });

                try {
                    await firstValueFrom(
                        this.http.post(`${API_URL}/sales`, {
                            items: sale.items,
                            ...sale.payment,
                            clientRef: sale.clientRef,
                            soldAt: sale.soldAt,
                        }),
                    );
                    await this.remove(sale.clientRef);
                    sent += 1;
                } catch (err) {
                    const error = err as HttpErrorResponse;

                    // Toujours sans réseau : on s'arrête là, rien n'est perdu
                    if (error.status === 0 || error.status === 429 || error.status >= 500) {
                        await this.put({ ...sale, status: "waiting", attempts: sale.attempts + 1 });
                        break;
                    }

                    // Session expirée : l'intercepteur s'en charge, la vente reste en attente
                    if (error.status === 401) {
                        await this.put({ ...sale, status: "waiting" });
                        break;
                    }

                    await this.put({
                        ...sale,
                        status: "error",
                        error: error.error?.message ?? "Vente refusée par le serveur.",
                        attempts: sale.attempts + 1,
                    });
                }
            }
        } finally {
            this.syncing = false;
        }

        if (sent > 0) {
            this.toast.show(
                sent === 1 ? "1 vente hors ligne envoyée." : `${sent} ventes hors ligne envoyées.`,
            );
            // Le stock réel vient du serveur
            this.catalog.refresh().catch(() => {});
        }
    }
}
