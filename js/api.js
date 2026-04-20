export async function fetchBinanceCandles(symbol, interval, limit = 350) {
    const intervalMap = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d" };
    const binanceInterval = intervalMap[interval] || "1h";
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceInterval}&limit=${limit}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return data.map(candle => ({
                time: candle[0] / 1000,
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
            }));
        }
    } catch (error) { console.error(error); return null; }
    return null;
}

export async function fetchBinanceTicker(symbol) {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error();
        const data = await response.json();
        return { close: parseFloat(data.lastPrice), change_24h: parseFloat(data.priceChangePercent) / 100 };
    } catch (error) { return null; }
}

export function generateRealisticMockData(bars = 350, startPrice = 65000) {
    const candles = [];
    let price = startPrice;
    let time = Math.floor(Date.now() / 1000) - bars * 3600;
    for (let i = 0; i < bars; i++) {
        const volatility = 0.005 + Math.random() * 0.01;
        const drift = (Math.random() - 0.48) * volatility;
        const open = price;
        const close = price * (1 + drift);
        const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.8);
        const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.8);
        const volume = 100 + Math.random() * 900 + Math.abs(drift) * 5000;
        candles.push({ time: time + i * 3600, open, high, low, close, volume });
        price = close;
    }
    return candles;
}