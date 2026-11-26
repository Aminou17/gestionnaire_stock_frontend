import { formatDate } from "@angular/common";
import { Injectable, LOCALE_ID, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";

import { AuthService } from "../auth/auth.service";
import { AuditLogService } from "./audit-log.service";

// Échecs du jour (connexions ratées, accès refusés) pour la cloche de l'administrateur
@Injectable({ providedIn: "root" })
export class SecurityAlertService {
    private auditService = inject(AuditLogService);
    private auth = inject(AuthService);
    private locale = inject(LOCALE_ID);

    // Route réservée à l'admin : rien n'est chargé pour le manager
    failures = rxResource({
        params: () => (this.auth.isAdmin() ? this.auth.user()?.id : undefined),
        stream: () =>
            this.auditService.getLogs({
                from: formatDate(new Date(), "yyyy-MM-dd", this.locale),
                to: null,
                userId: null,
                action: null,
                result: "FAILURE",
                page: 1,
                limit: 3,
            }),
    });

    count = computed(() => (this.failures.hasValue() ? this.failures.value().pagination.total : 0));
    latest = computed(() => (this.failures.hasValue() ? this.failures.value().data : []));

    // Sans valeur, ni 0 ni "aucun échec" ne doivent s'afficher
    failed = computed(() => this.failures.error() !== undefined);
    loading = computed(() => this.failures.isLoading() && !this.failures.hasValue());

    reload() {
        this.failures.reload();
    }
}
