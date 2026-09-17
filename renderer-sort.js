globalThis.ItemSortEngine = {
    sortItems: function(itemsArray, column, direction) {
        if (!itemsArray || itemsArray.length === 0) return [];
        
        const sorted = [...itemsArray];
        let modifier = direction === 'asc' ? 1 : -1;

        sorted.sort((a, b) => {
            switch (column) {
                case 'name':
                    return a.name.localeCompare(b.name) * modifier;
                case 'qty':
                    return (a.totalQty - b.totalQty) * modifier;
                case 'recent':
                    return (a.totalRecentValueGold - b.totalRecentValueGold) * modifier;
                case 'price':
                    return (a.totalSaleAvgValueGold - b.totalSaleAvgValueGold) * modifier;
                case 'trend':
                    return (a.fluctuation - b.fluctuation) * modifier;
                default:
                    return 0;
            }
        });
        return sorted;
    }
};