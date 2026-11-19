import { Pipe, PipeTransform } from "@angular/core";

const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// 245500 -> "245 500 F"
@Pipe({ name: "fcfa" })
export class FcfaPipe implements PipeTransform {
    transform(value: number | null | undefined, signed = false) {
        if (value === null || value === undefined) return "—";
        // l'espace fine du français disparaît presque en petit texte ("1300 F") :
        // on la remplace par une espace insécable normale, bien visible
        const digits = formatter.format(Math.abs(value)).replace(/ /g, " ");
        const amount = `${digits} F`;
        if (value < 0) return `−${amount}`;
        return signed && value > 0 ? `+${amount}` : amount;
    }
}
