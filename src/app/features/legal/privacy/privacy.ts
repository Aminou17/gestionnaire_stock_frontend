import { Component } from "@angular/core";

import { LegalPage } from "../legal-page/legal-page";
import { PRIVACY_INTRO, PRIVACY_SECTIONS, PRIVACY_UPDATED } from "./privacy-content";

@Component({
    selector: "app-privacy",
    imports: [LegalPage],
    template: `
        <app-legal-page
            title="Politique de confidentialité"
            [intro]="intro"
            [updated]="updated"
            [sections]="sections"
        />
    `,
})
export class Privacy {
    protected intro = PRIVACY_INTRO;
    protected updated = PRIVACY_UPDATED;
    protected sections = PRIVACY_SECTIONS;
}
