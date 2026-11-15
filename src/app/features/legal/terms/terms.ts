import { Component } from "@angular/core";

import { LegalPage } from "../legal-page/legal-page";
import { TERMS_INTRO, TERMS_SECTIONS, TERMS_UPDATED } from "./terms-content";

@Component({
    selector: "app-terms",
    imports: [LegalPage],
    template: `
        <app-legal-page
            title="Conditions d'utilisation"
            [intro]="intro"
            [updated]="updated"
            [sections]="sections"
        />
    `,
})
export class Terms {
    protected intro = TERMS_INTRO;
    protected updated = TERMS_UPDATED;
    protected sections = TERMS_SECTIONS;
}
