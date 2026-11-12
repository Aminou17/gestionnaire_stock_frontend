import { Component, inject } from "@angular/core";

import { ThemeService } from "../../../core/theme/theme.service";
import { PageHeader } from "../../../layout/page-header/page-header";
import { Icon } from "../../../shared/icon/icon";

@Component({
    selector: "app-settings-appearance",
    imports: [PageHeader, Icon],
    templateUrl: "./settings-appearance.html",
    styleUrls: ["../settings-section.css", "./settings-appearance.css"],
})
export class SettingsAppearance {
    protected theme = inject(ThemeService);

    themes = [
        { value: "light", label: "Clair" },
        { value: "dark", label: "Sombre" },
    ] as const;
}
