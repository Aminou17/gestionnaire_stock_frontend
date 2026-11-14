import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { API_URL } from "../../core/api.config";
import {
    CreatedShop,
    NewShopInput,
    OwnedShop,
    OwnedShopDetail,
    ShopStatus,
    TemporaryPassword,
} from "./owned-shop.model";

@Injectable({ providedIn: "root" })
export class OwnerShopService {
    private http = inject(HttpClient);

    getShops() {
        return this.http.get<OwnedShop[]>(`${API_URL}/shops`);
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

    // jours d'essai à partir d'aujourd'hui, ou null pour retirer l'essai
    setTrial(id: number, trialDays: number | null) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/trial`, { trialDays });
    }

    setStatus(id: number, status: ShopStatus) {
        return this.http.patch<OwnedShop>(`${API_URL}/shops/${id}/status`, { status });
    }
}
