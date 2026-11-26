import { IconName } from "../../shared/icon/icons";

export interface ExpenseCategory {
    value: string;
    label: string;
    // Nom court pour les pastilles et les carreaux
    short: string;
    icon: IconName;
    // Couleur propre au motif : la même partout (carreaux, barres, listes)
    color: string;
}

// Même liste et même ordre que REASON_CATEGORIES.EXPENSE côté backend
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    {
        value: "SUPPLIES",
        label: "Fournitures de la boutique",
        short: "Fournitures",
        icon: "package",
        color: "#2563eb",
    },
    { value: "TRANSPORT", label: "Transport", short: "Transport", icon: "truck", color: "#7c3aed" },
    { value: "FOOD", label: "Repas", short: "Repas", icon: "utensils", color: "#ea580c" },
    {
        value: "SALARY",
        label: "Salaire ou avance",
        short: "Salaires",
        icon: "users",
        color: "#16a34a",
    },
    {
        value: "BILLS",
        label: "Factures (électricité, eau, téléphone)",
        short: "Factures",
        icon: "zap",
        color: "#ca8a04",
    },
    {
        value: "REPAIR",
        label: "Réparation et entretien",
        short: "Réparations",
        icon: "wrench",
        color: "#0891b2",
    },
    { value: "OTHER", label: "Autre", short: "Autre", icon: "receipt", color: "#64748b" },
];

// Une dépense sans motif est rangée dans Autre
export const expenseCategory = (value: string | null): ExpenseCategory =>
    EXPENSE_CATEGORIES.find((category) => category.value === value) ??
    EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
