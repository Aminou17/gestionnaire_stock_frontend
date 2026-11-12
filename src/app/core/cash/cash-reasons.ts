import { ManualMovementType } from "./cash.model";

// même liste que REASON_CATEGORIES côté backend (cashMovement.service.js)
export const CASH_REASONS: Record<ManualMovementType, { value: string; label: string }[]> = {
    DEPOSIT: [
        { value: "CHANGE", label: "Monnaie pour la caisse" },
        { value: "OWNER_CONTRIBUTION", label: "Apport du propriétaire" },
        { value: "OTHER", label: "Autre" },
    ],
    EXPENSE: [
        { value: "SUPPLIES", label: "Fournitures de la boutique" },
        { value: "TRANSPORT", label: "Transport" },
        { value: "FOOD", label: "Repas" },
        { value: "SALARY", label: "Salaire ou avance" },
        { value: "BILLS", label: "Factures (électricité, eau, téléphone)" },
        { value: "REPAIR", label: "Réparation et entretien" },
        { value: "OTHER", label: "Autre" },
    ],
    WITHDRAWAL: [
        { value: "BANK_DEPOSIT", label: "Dépôt à la banque" },
        { value: "SAFE", label: "Mise au coffre" },
        { value: "OWNER_WITHDRAWAL", label: "Retrait du propriétaire" },
        { value: "OTHER", label: "Autre" },
    ],
};

export const getReasonLabel = (type: string, category: string | null) =>
    CASH_REASONS[type as ManualMovementType]?.find((reason) => reason.value === category)?.label ??
    null;
