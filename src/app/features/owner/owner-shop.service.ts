import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../core/api.config";
import {
    CreatedShop,
    MarginReport,
    NewShopInput,
    OwnedShop,
    OwnedShopDetail,
    ShopModules,
    ShopStatus,
    ShopUsage,
    SubscriptionsState,
    TemporaryPassword,
    UsageReport,
} from "./owned-shop.model";

@Injectable({ providedIn: "root" })
export class OwnerShopService {
    private http = inject(HttpClient);

    getShops() {
        return this.http.get<OwnedShop[]>(`${API_URL}/shops`);
    }

    getSubscriptions() {
        return this.http.get<SubscriptionsState>(`${API_URL}/platform/subscriptions`);
    }

    // active ou désactive la page Abonnement pour toutes les boutiques
    setSubscriptions(enabled: boolean) {
        return this.http.put<SubscriptionsState>(`${API_URL}/platform/subscriptions`, { enabled });
    }

    // les accès d'une boutique, chacun avec son état
    getShopModules(id: number) {
        return this.http.get<ShopModules>(`${API_URL}/shops/${id}/modules`);
    }

    // disabled : les accès retirés ; une liste vide rend tout
    setShopModules(id: number, disabled: string[]) {
        return this.http.put<ShopModules>(`${API_URL}/shops/${id}/modules`, { disabled });
    }

    // marge de chaque boutique sur les derniers jours
    getMargins(days = 30) {
        return this.http.get<MarginReport>(`${API_URL}/shops/stats/margins`, { params: { days } });
    }

    // pages ouvertes chaque jour dans chaque boutique
    getUsage(days = 7) {
        return this.http.get<UsageReport>(`${API_URL}/shops/stats/usage`, { params: { days } });
    }

    // activité d'une boutique : pages ouvertes par jour et pages les plus utilisées
    getShopUsage(id: number, days = 14) {
        return this.http.get<ShopUsage>(`${API_URL}/shops/${id}/usage`, { params: { days } });
    }

    getShop(id: number) {
        return this.http.get<OwnedShopDetail>(`${API_URL}/shops/${id}`);
    }

    // lien envoyé par e-mail : le propriétaire ne voit jamais le mot de passe choisi
    sendResetLink(id: number, userId: number) {
        return this.http.post<{ message: string }>(`${API_URL}/shops/${id}/reset-link`, { userId });
    }

    // affiché une seule fois ; la personne devra le changer à sa prochaine connexion
    setTemporaryPassword(id: number, userId: number) {
        return this.http.post<TemporaryPassword>(`${API_URL}/shops/${id}/temporary-password`, {
            userId,
        });
    }

    createShop(input: NewShopInput) {
        return this.http.post<CreatedShop>(`${API_URL}/shops`, input);
    }

    // dernier jour payé inclus (AAAA-MM-JJ), ou null pour retirer la date
    setPaidUntil(id: number, paidUntil: string | null) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/paid-until`, { paidUntil });
    }

    // jours d'essai à partir d'aujourd'hui, ou null pour retirer l'essai
    setTrial(id: number, trialDays: number | null) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/trial`, { trialDays });
    }

    setStatus(id: number, status: ShopStatus) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/status`, { status });
    }

    // la boutique est bloquée et gardée 90 jours avant d'être effacée
    deleteShop(id: number) {
        return this.http.delete<OwnedShop>(`${API_URL}/shops/${id}`);
    }

    restoreShop(id: number) {
        return this.http.post<OwnedShop>(`${API_URL}/shops/${id}/restore`, {});
    }
}
