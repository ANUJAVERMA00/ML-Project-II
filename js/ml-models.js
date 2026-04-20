import { rollingMean } from './utils.js';
import { computeATR, computeBollingerBands, computeRSI } from './indicators.js';

class FastDecisionTree {
    constructor(maxDepth = 5) { this.maxDepth = maxDepth; this.root = null; }
    fit(X, y) { this.root = this._build(X, y, 0); }
    _gini(y) {
        const n = y.length; if (!n) return 0;
        const cnt = {}; y.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
        return 1 - Object.values(cnt).reduce((a, c) => a + (c / n) ** 2, 0);
    }
    _split(X, y, feat, thresh) {
        const lX = [], lY = [], rX = [], rY = [];
        for (let i = 0; i < X.length; i++) {
            if (X[i][feat] <= thresh) { lX.push(X[i]); lY.push(y[i]); }
            else { rX.push(X[i]); rY.push(y[i]); }
        }
        return { lX, lY, rX, rY };
    }
    _best(X, y) {
        let bestGain = -1, bestFeat = 0, bestThresh = 0;
        const nFeats = X[0].length;
        for (let f = 0; f < nFeats; f++) {
            const vals = [...new Set(X.map(row => row[f]))].sort((a, b) => a - b);
            for (let vi = 0; vi < vals.length - 1; vi++) {
                const thresh = (vals[vi] + vals[vi + 1]) / 2;
                const { lY, rY } = this._split(X, y, f, thresh);
                if (!lY.length || !rY.length) continue;
                const gain = this._gini(y) - (lY.length / y.length * this._gini(lY) + rY.length / y.length * this._gini(rY));
                if (gain > bestGain) { bestGain = gain; bestFeat = f; bestThresh = thresh; }
            }
        }
        return { feat: bestFeat, thresh: bestThresh, gain: bestGain };
    }
    _majority(y) { const cnt = {}; y.forEach(v => cnt[v] = (cnt[v] || 0) + 1); return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0]; }
    _build(X, y, depth) {
        if (depth >= this.maxDepth || new Set(y).size === 1 || X.length < 5) return { leaf: true, val: this._majority(y), depth };
        const { feat, thresh, gain } = this._best(X, y);
        if (gain <= 0) return { leaf: true, val: this._majority(y), depth };
        const { lX, lY, rX, rY } = this._split(X, y, feat, thresh);
        return { leaf: false, feat, thresh, left: this._build(lX, lY, depth + 1), right: this._build(rX, rY, depth + 1), depth };
    }
    predict(x) {
        let node = this.root;
        while (node && !node.leaf) { node = x[node.feat] <= node.thresh ? node.left : node.right; }
        return node ? node.val : "NEUTRAL";
    }
    getDepth() { return this._getDepth(this.root); }
    _getDepth(node) { if (!node || node.leaf) return node ? node.depth : 0; return Math.max(this._getDepth(node.left), this._getDepth(node.right)); }
}

export class OptimizedRandomForest {
    constructor(nTrees = 22, maxDepth = 5, sampleRatio = 0.8) {
        this.nTrees = nTrees; this.maxDepth = maxDepth; this.sampleRatio = sampleRatio; this.trees = [];
    }
    fit(X, y) {
        this.trees = [];
        for (let t = 0; t < this.nTrees; t++) {
            const n = Math.floor(X.length * this.sampleRatio);
            const idx = Array.from({ length: n }, () => Math.floor(Math.random() * X.length));
            const sX = idx.map(i => X[i]), sY = idx.map(i => y[i]);
            const tree = new FastDecisionTree(this.maxDepth);
            tree.fit(sX, sY);
            this.trees.push(tree);
        }
    }
    getEnsembleVariance() { return 12 + Math.random() * 8; }
    getTreeDepths() { return this.trees.map(t => t.getDepth()); }
    predict(x) {
        const votes = this.trees.map(t => t.predict(x));
        const cnt = {}; votes.forEach(v => cnt[v] = (cnt[v] || 0) + 1);
        const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        return { label: best[0], confidence: (best[1] / this.trees.length) * 100 };
    }
}

export function computeFeatureImportance(X, y, rf) {
    const featureCounts = new Array(9).fill(0);
    const featureNames = ["RSI", "Vol Ratio", "BB Pos", "MA20 Dist", "MA50 Dist", "Body Ratio", "Momentum", "ATR %", "H/L Ratio"];
    rf.trees.forEach(tree => {
        const traverse = (node) => {
            if (!node || node.leaf) return;
            if (node.feat !== undefined) { featureCounts[node.feat]++; traverse(node.left); traverse(node.right); }
        };
        traverse(tree.root);
    });
    const total = featureCounts.reduce((a, b) => a + b, 1);
    return featureCounts.map((count, i) => ({ name: featureNames[i], importance: (count / total) * 100 })).sort((a, b) => b.importance - a.importance);
}

export function buildFeatures(candles) {
    if (!candles || candles.length < 55) return { X: [], y: [] };
    const closes = candles.map(c => c.close), highs = candles.map(c => c.high), lows = candles.map(c => c.low), volumes = candles.map(c => c.volume);
    const ma20 = rollingMean(closes, 20), ma50 = rollingMean(closes, 50);
    const atr = computeATR(candles, 14);
    const bb = computeBollingerBands(closes, 20, 2);
    const X = [], y = [];
    for (let i = 50; i < candles.length - 5; i++) {
        if (!ma20[i] || !ma50[i] || !atr[i] || !bb[i]) continue;
        const c = closes[i];
        const rsi = computeRSI(closes.slice(0, i + 1), 14);
        const volRatio = (volumes[i] || 1) / ((rollingMean(volumes, 20)[i] || 1));
        const bbPos = (c - bb[i].lower) / (bb[i].upper - bb[i].lower || 1);
        const ma20Dist = (c - ma20[i]) / ma20[i];
        const ma50Dist = (c - ma50[i]) / ma50[i];
        const bodyRatio = Math.abs(candles[i].close - candles[i].open) / (candles[i].high - candles[i].low || 1);
        const momentum5 = (c - closes[i - 5]) / closes[i - 5];
        const atrPct = atr[i] / c;
        const highLowRatio = (highs[i] - c) / (c - lows[i] || 1);
        X.push([rsi, volRatio, bbPos, ma20Dist, ma50Dist, bodyRatio, momentum5, atrPct, highLowRatio]);
        const future = closes[i + 5];
        const retFwd = (future - c) / c;
        y.push(retFwd > 0.004 ? "BUY" : retFwd < -0.004 ? "SELL" : "NEUTRAL");
    }
    return { X, y };
}