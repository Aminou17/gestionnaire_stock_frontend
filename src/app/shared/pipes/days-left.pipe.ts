import { Pipe, PipeTransform } from "@angular/core";

// au-delà d'un an, le nombre exact de jours n'aide pas à décider
const ONE_YEAR = 365;

// 12 -> "12 j", 1530 -> "plus d'un an"
@Pipe({ name: "daysLeft" })
export class DaysLeftPipe implements PipeTransform {
    transform(value: number | null | undefined) {
        if (value === null || value === undefined) return "Pas de vente";
        return value > ONE_YEAR ? "plus d'un an" : `${value} j`;
    }
}
