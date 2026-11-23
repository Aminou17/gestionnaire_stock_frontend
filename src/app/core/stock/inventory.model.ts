// in_progress : comptage ouvert ; counted : comptage terminé, en attente de l'admin ;
// applied : stock corrigé ; cancelled : abandonné
export type InventoryStatus = "in_progress" | "counted" | "applied" | "cancelled";

export interface InventoryPerson {
    id: number;
    name: string;
    // la photo n'est envoyée que par le détail
    avatar: string | null;
}

export interface Inventory {
    id: number;
    name: string | null;
    status: InventoryStatus;
    statusLabel: string;
    scope: { type: "all" | "category"; categoryId: number | null; categoryName: string | null };
    startedAt: string;
    countedAt: string | null;
    appliedAt: string | null;
    cancelledAt: string | null;
    createdBy: InventoryPerson;
    countedBy: InventoryPerson | null;
    appliedBy: InventoryPerson | null;
    cancelledBy: InventoryPerson | null;
    itemsCount: number;
    countedCount: number;
    uncountedCount: number;
    // masqués (null) pour le gérant : écarts pendant le comptage, valeur en francs toujours
    differenceCount: number | null;
    differenceValue: number | null;
    maxStock: number;
}

export interface InventoryItem {
    id: number;
    productId: number;
    productName: string;
    image: string | null;
    counted: boolean;
    actualStock: number | null;
    countedAt: string | null;
    // null pour le gérant tant que le comptage est en cours, et pour lui toujours pour les prix
    theoreticalStock: number | null;
    difference: number | null;
    purchasePrice: number | null;
    differenceValue: number | null;
    // remplis seulement après la correction du stock
    adjustment: number | null;
    movementsSince: number | null;
    expectedStock: number | null;
    stockBefore: number | null;
    stockAfter: number | null;
    applyNote: string | null;
}

export interface PageInfo {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface InventoryList {
    data: Inventory[];
    pagination: PageInfo;
}

export interface InventoryDetail extends Inventory {
    items: InventoryItem[];
    pagination: PageInfo;
}

export interface InventoryFilters {
    statuses: InventoryStatus[];
    search: string;
    page: number;
    limit: number;
}

export type ItemFilter = "all" | "counted" | "uncounted" | "differences";

export interface ItemQuery {
    filter: ItemFilter;
    search: string;
    page: number;
    limit: number;
}

export interface NewInventory {
    name?: string;
    categoryId?: number;
    // identifiant créé par l'appareil : un réessai ne crée pas un deuxième inventaire
    clientKey: string;
}

export interface CountLine {
    productId: number;
    actualStock: number;
}

export interface CloseResult {
    inventory: Inventory;
    uncounted: { count: number; items: { productId: number; productName: string }[] };
    countedMissingAsZero: boolean;
}

export interface ApplyResult {
    inventory: Inventory;
    applied: number;
    unchanged: number;
    skipped: { productId: number; productName: string; reason: string }[];
    limitedToZero: { productId: number; productName: string; wanted: number; applied: number }[];
}

interface MovementTotal {
    movements: number;
    units: number;
}

export interface MovementsSince {
    since: string;
    totals: {
        sales: MovementTotal;
        returns: MovementTotal;
        entries: MovementTotal;
        others: MovementTotal;
    };
    productsCount: number;
    products: { productId: number; productName: string; movements: number; netChange: number }[];
}

// réponse du serveur quand un comptage est déjà ouvert
export interface InProgressConflict {
    code: "INVENTORY_IN_PROGRESS";
    existing: { id: number; name: string | null; status: InventoryStatus };
}
