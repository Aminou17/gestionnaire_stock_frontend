import { HttpErrorResponse } from "@angular/common/http";
import { DestroyRef, Injectable, computed, effect, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { dbDelete, dbGet, dbSet } from "../../core/offline/local-db";
import { isUnreachable } from "../../core/offline/network.interceptor";
import { NetworkService } from "../../core/offline/network.service";
import { Inventory } from "../../core/stock/inventory.model";
import { InventoryService } from "../../core/stock/inventory.service";

// saved : tout est au serveur ; saving : envoi en cours ou à venir ; offline : gardé sur l'appareil ;
// error : le serveur a refusé
export type SaveState = "saved" | "saving" | "offline" | "error";

// quantité comptée, ou null pour remettre le produit à « non compté »
export type Counts = Record<number, number | null>;

const DEBOUNCE_MS = 800;
const RETRY_MS = 15_000;
// un paquet ne dépasse pas ce nombre de lignes (le serveur en accepte 5000)
const CHUNK = 500;

const draftKey = (inventoryId: number) => `inventory-draft-${inventoryId}`;

// Envoie les saisies d'un comptage au serveur, par petits paquets groupés. Chaque saisie est aussi
// gardée sur l'appareil (brouillon) : sans réseau ou si la page se ferme, rien n'est perdu et
// le brouillon est renvoyé à la réouverture. À fournir par la page de comptage.
@Injectable()
export class CountSync {
    private inventoryService = inject(InventoryService);
    private network = inject(NetworkService);

    // saisies pas encore reçues par le serveur
    readonly pending = signal<Counts>({});
    readonly state = signal<SaveState>("saved");
    readonly error = signal("");
    readonly pendingCount = computed(() => Object.keys(this.pending()).length);

    // appelé quand le serveur a reçu un paquet : l'inventaire à jour et ce qui vient d'être envoyé
    onSaved: (inventory: Inventory, sent: Counts) => void = () => {};

    private inventoryId = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private retry: ReturnType<typeof setTimeout> | undefined;
    private running: Promise<boolean> | null = null;

    constructor() {
        // le réseau revient : on renvoie tout de suite
        effect(() => {
            if (this.network.online() && this.pendingCount() > 0 && this.state() === "offline") {
                void this.flush();
            }
        });

        inject(DestroyRef).onDestroy(() => {
            clearTimeout(this.timer);
            clearTimeout(this.retry);
        });
    }

    // reprend le brouillon de cet appareil et l'envoie
    async start(inventoryId: number) {
        this.inventoryId = inventoryId;

        const draft = await dbGet<Counts>("kv", draftKey(inventoryId));
        if (draft && Object.keys(draft).length > 0) {
            // ce qui a déjà été saisi depuis l'ouverture de la page l'emporte sur le brouillon
            this.pending.update((current) => ({ ...draft, ...current }));
            await this.flush();
        }
    }

    // enregistre une saisie ; l'envoi part 800 ms après la dernière frappe
    set(productId: number, value: number | null) {
        this.pending.update((counts) => ({ ...counts, [productId]: value }));
        this.state.set(this.network.online() ? "saving" : "offline");
        void this.saveDraft();

        clearTimeout(this.timer);
        this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
    }

    // annule une saisie qui n'a plus rien à envoyer (champ vidé sur un produit jamais compté)
    forget(productId: number) {
        this.pending.update(({ [productId]: _, ...rest }) => rest);
        void this.saveDraft();
        if (this.pendingCount() === 0) this.state.set("saved");
    }

    // envoie tout ce qui attend ; vrai si tout est arrivé
    flush(): Promise<boolean> {
        clearTimeout(this.timer);

        if (this.running) return this.running.then(() => this.flush());

        this.running = this.send().finally(() => (this.running = null));
        return this.running;
    }

    // vide le brouillon : le comptage est terminé
    async clearDraft() {
        await dbDelete("kv", draftKey(this.inventoryId));
    }

    private async send(): Promise<boolean> {
        const batch = { ...this.pending() };
        const entries = Object.entries(batch).map(([id, value]) => [Number(id), value] as const);

        if (entries.length === 0) {
            this.state.set("saved");
            return true;
        }

        this.state.set("saving");
        this.error.set("");

        try {
            const counts = entries
                .filter(([, value]) => value !== null)
                .map(([productId, value]) => ({ productId, actualStock: value as number }));
            let inventory: Inventory | undefined;

            for (let i = 0; i < counts.length; i += CHUNK) {
                const result = await firstValueFrom(
                    this.inventoryService.saveItems(this.inventoryId, counts.slice(i, i + CHUNK)),
                );
                inventory = result.inventory;
            }

            for (const [productId] of entries.filter(([, value]) => value === null)) {
                const result = await firstValueFrom(
                    this.inventoryService.uncount(this.inventoryId, productId),
                );
                inventory = result.inventory;
            }

            // une valeur changée pendant l'envoi reste en attente
            this.pending.update((current) => {
                const left = { ...current };
                for (const [productId, value] of entries) {
                    if (left[productId] === value) delete left[productId];
                }
                return left;
            });
            await this.saveDraft();

            if (inventory) this.onSaved(inventory, batch);
        } catch (err) {
            this.fail(err as HttpErrorResponse);
            return false;
        }

        // de nouvelles saisies sont arrivées pendant l'envoi : le prochain passage les prend
        if (this.pendingCount() > 0) {
            this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS);
            return true;
        }

        this.state.set("saved");
        await this.clearDraft();
        return true;
    }

    private fail(err: HttpErrorResponse) {
        if (isUnreachable(err.status)) {
            this.state.set("offline");
            clearTimeout(this.retry);
            this.retry = setTimeout(() => void this.flush(), RETRY_MS);
            return;
        }

        this.state.set("error");
        this.error.set(err.error?.message ?? "Les saisies n'ont pas pu être enregistrées.");
    }

    private async saveDraft() {
        if (this.pendingCount() === 0) {
            await this.clearDraft();
            return;
        }
        await dbSet("kv", draftKey(this.inventoryId), this.pending());
    }
}
