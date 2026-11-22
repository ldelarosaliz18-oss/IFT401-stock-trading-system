let marketStocks = null;
let marketStocksRequest = null;

function loadMarketStocks() {
  if (marketStocks) return Promise.resolve(marketStocks);
  if (!marketStocksRequest) {
    marketStocksRequest = apiRequest("/market/stocks")
      .then((stocks) => {
        marketStocks = stocks;
        return stocks;
      })
      .finally(() => {
        marketStocksRequest = null;
      });
  }
  return marketStocksRequest;
}

async function refreshMarketStocks() {
  marketStocks = await apiRequest("/market/stocks");
  return marketStocks;
}
