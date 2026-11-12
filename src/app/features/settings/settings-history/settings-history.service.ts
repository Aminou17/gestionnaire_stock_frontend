import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { forkJoin, map } from "rxjs";

import { API_URL } from "../../../core/api.config";

export interface SettingsChange {
    user_name: string | null;
    created_at: string;
}

interface AuditPage {
    data: SettingsChange[];
}

// dernière modification d'un réglage, lue dans le journal d'audit (réservé au propriétaire)
@Injectable({ providedIn: "root" })
export class SettingsHistoryService {
    private http = inject(HttpClient);

    // plusieurs actions possibles : le logo et les coordonnées sont deux actions du même ticket
    getLastChange(actions: string[]) {
        const requests = actions.map((action) =>
            this.http.get<AuditPage>(`${API_URL}/audit-logs`, {
                params: { action, result: "SUCCESS", limit: 1 },
            }),
        );

        return forkJoin(requests).pipe(
            map((pages) => {
                const changes = pages.flatMap((page) => page.data);
                changes.sort((a, b) => b.created_at.localeCompare(a.created_at));

                return changes[0] ?? null;
            }),
        );
    }
}
