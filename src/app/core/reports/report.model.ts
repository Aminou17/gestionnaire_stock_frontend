// Bilan de la boutique renvoyé par GET /reports/balance (réservé à l'admin)

export interface StockCategory {
    categoryId: number;
    categoryName: string;
    products: number;
    units: number;
    purchaseValue: number;
    saleValue: number;
}

export interface ExpenseByCategory {
    category: string;
    count: number;
    total: number;
}

export interface Balance {
    stock: {
        date: string;
        products: number;
        units: number;
        purchaseValue: number;
        saleValue: number;
        potentialProfit: number;
        categories: StockCategory[];
    };
    period: { from: string; to: string };
    sales: { count: number; revenue: number; cost: number; grossProfit: number };
    expenses: { total: number; count: number; categories: ExpenseByCategory[] };
    netProfit: number;
}

export interface BalanceQuery {
    date: string;
    from: string;
    to: string;
}
