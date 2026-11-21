import { DatePipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { rxResource } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { Icon } from "../../../../shared/icon/icon";
import { SecurityService } from "../security.service";

@Component({
    selector: "app-security-overview",
    imports: [DatePipe, RouterLink, Icon],
    templateUrl: "./security-overview.html",
    styleUrls: ["../security-shared.css", "./security-overview.css"],
})
export class SecurityOverview {
    private security = inject(SecurityService);

    overview = rxResource({ stream: () => this.security.getOverview() });

    // résumé en une phrase, en tête de page
    status = computed(() => {
        if (!this.overview.hasValue()) return null;
        const { failedLogins24h, lockedAccounts } = this.overview.value();

        if (failedLogins24h === 0 && lockedAccounts === 0) {
            return { tone: "ok", text: "Rien d'anormal ces dernières 24 heures." };
        }

        const parts = [];
        if (failedLogins24h > 0) {
            parts.push(
                `${failedLogins24h} connexion${failedLogins24h > 1 ? "s" : ""} échouée${failedLogins24h > 1 ? "s" : ""}`,
            );
        }
        if (lockedAccounts > 0) {
            parts.push(
                `${lockedAccounts} compte${lockedAccounts > 1 ? "s" : ""} bloqué${lockedAccounts > 1 ? "s" : ""}`,
            );
        }
        return { tone: "warn", text: `À surveiller : ${parts.join(" et ")}.` };
    });

    // hauteur des barres : le jour le plus chargé donne 100 %
    days = computed(() => {
        if (!this.overview.hasValue()) return [];
        const daily = this.overview.value().daily;
        const max = Math.max(1, ...daily.map((d) => d.failed_logins + d.access_denied));

        return daily.map((d) => ({
            ...d,
            total: d.failed_logins + d.access_denied,
            loginsHeight: (d.failed_logins / max) * 100,
            deniedHeight: (d.access_denied / max) * 100,
            // la date est lue à midi pour éviter un décalage de fuseau
            date: new Date(d.day + "T12:00:00"),
        }));
    });

    hasActivity = computed(() => this.days().some((d) => d.total > 0));

    // part de la boutique la plus visée : barre horizontale
    topShops = computed(() => {
        if (!this.overview.hasValue()) return [];
        const shops = this.overview.value().topShops;
        const max = Math.max(1, ...shops.map((s) => s.failed_logins + s.access_denied));

        return shops.map((s) => ({
            ...s,
            total: s.failed_logins + s.access_denied,
            width: ((s.failed_logins + s.access_denied) / max) * 100,
        }));
    });

    skeletons = [1, 2, 3, 4];
}
