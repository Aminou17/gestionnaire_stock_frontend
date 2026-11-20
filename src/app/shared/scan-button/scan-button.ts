import { Component, input, output } from "@angular/core";

import { BarcodeScanner } from "../barcode-scanner/barcode-scanner";
import { Icon } from "../icon/icon";

// Bouton de scan placé au bout d'un champ de recherche de produit.
// Le champ parent porte la classe "has-scan" pour laisser la place au bouton,
// sauf avec inline : le bouton prend alors sa place dans une ligne en flex.
@Component({
    selector: "app-scan-button",
    imports: [BarcodeScanner, Icon],
    template: `
        <button
            type="button"
            class="scan"
            aria-label="Scanner un code-barres"
            title="Scanner un code-barres"
            (click)="scanner.start()"
        >
            <app-icon name="scan" [size]="20" />
        </button>
        <app-barcode-scanner #scanner (scanned)="scanned.emit($event)" />
    `,
    styleUrl: "./scan-button.css",
    host: { "[class.inline]": "inline()" },
})
export class ScanButton {
    readonly inline = input(false);
    readonly scanned = output<string>();
}
