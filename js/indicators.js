import { rollingMean, rollingStd } from './utils.js';

export function computeATR(candles, period = 14) {
    const trs = candles.map((c, i) => {
        if (i === 0) return c.high - c.low;
        const prevClose = candles[i - 1].close;
        return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
    });
    return rollingMean(trs, period);
}

export function computeRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change >= 0) gains += change; else losses -= change;
    }
    const avgGain = gains / period, avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

export function computeVolumeProfile(candles, bins = 30) {
    if (!candles || candles.length < 10) return [];
    const highs = candles.map(c => c.high), lows = candles.map(c => c.low);
    const minP = Math.min(...lows), maxP = Math.max(...highs);
    const step = (maxP - minP) / bins;
    const profile = Array.from({ length: bins }, (_, i) => ({ priceFrom: minP + i * step, priceTo: minP + (i + 1) * step, vol: 0, trades: 0 }));
    candles.forEach(c => {
        const typicalPrice = (c.high + c.low + c.close) / 3;
        const bin = Math.min(Math.floor((typicalPrice - minP) / step), bins - 1);
        if (bin >= 0 && bin < bins) {
            profile[bin].vol += c.volume;
            profile[bin].trades += 1;
        }
    });
    const totalVol = profile.reduce((a, b) => a + b.vol, 0) || 1;
    return profile.map(p => ({ ...p, pct: p.vol / totalVol * 100 }));
}

export function findPivots(candles, leftBars = 5, rightBars = 5) {
    const pivotHighs = [], pivotLows = [];
    for (let i = leftBars; i < candles.length - rightBars; i++) {
        let isHigh = true, isLow = true;
        for (let j = i - leftBars; j <= i + rightBars; j++) {
            if (candles[j].high > candles[i].high) isHigh = false;
            if (candles[j].low < candles[i].low) isLow = false;
        }
        if (isHigh) pivotHighs.push({ idx: i, price: candles[i].high, time: candles[i].time });
        if (isLow) pivotLows.push({ idx: i, price: candles[i].low, time: candles[i].time });
    }
    return { pivotHighs, pivotLows };
}

export function clusterLevels(prices, threshold = 0.005) {
    if (!prices.length) return [];
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters = [];
    let group = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i] - sorted[i - 1]) / sorted[i - 1] < threshold) group.push(sorted[i]);
        else { clusters.push(group.reduce((a, b) => a + b, 0) / group.length); group = [sorted[i]]; }
    }
    if (group.length) clusters.push(group.reduce((a, b) => a + b, 0) / group.length);
    return clusters;
}

export function computeBollingerBands(closes, period = 20, mult = 2) {
    const mu = rollingMean(closes, period);
    const std = rollingStd(closes, period, mu);
    return mu.map((m, i) => m === null ? null : { upper: m + mult * std[i], mid: m, lower: m - mult * std[i] });
}

export function kMeansCluster(prices, k = 8, iters = 40) {
    if (prices.length < k) return prices.map(p => ({ center: p, members: [p], strength: 1 }));
    let centroids = [prices[Math.floor(Math.random() * prices.length)]];
    while (centroids.length < k) {
        const dists = prices.map(p => Math.min(...centroids.map(c => Math.abs(p - c))));
        const total = dists.reduce((a, b) => a + b, 0);
        let r = Math.random() * total, cum = 0;
        for (let i = 0; i < prices.length; i++) { cum += dists[i]; if (cum >= r) { centroids.push(prices[i]); break; } }
    }
    for (let iter = 0; iter < iters; iter++) {
        const groups = Array.from({ length: k }, () => []);
        prices.forEach(p => {
            let best = 0, bestDist = Math.abs(p - centroids[0]);
            for (let i = 1; i < k; i++) { const d = Math.abs(p - centroids[i]); if (d < bestDist) { bestDist = d; best = i; } }
            groups[best].push(p);
        });
        centroids = groups.map((g, i) => g.length ? g.reduce((a, b) => a + b, 0) / g.length : centroids[i]);
    }
    const finalGroups = Array.from({ length: k }, () => []);
    prices.forEach(p => {
        let best = 0, bestDist = Math.abs(p - centroids[0]);
        for (let i = 1; i < k; i++) { const d = Math.abs(p - centroids[i]); if (d < bestDist) { bestDist = d; best = i; } }
        finalGroups[best].push(p);
    });
    return centroids.map((center, i) => ({ center, members: finalGroups[i], strength: finalGroups[i].length })).filter(c => c.members.length > 0).sort((a, b) => b.strength - a.strength);
}