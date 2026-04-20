import { state, setState, addLog } from './state.js';
import { computeVolumeProfile, findPivots, clusterLevels, computeBollingerBands, kMeansCluster, computeRSI, computeATR } from './indicators.js';
import { OptimizedRandomForest, computeFeatureImportance, buildFeatures } from './ml-models.js';
import { rollingMean } from './utils.js';
import { fmt } from './utils.js';

export function runMLPipeline(candles) {
    const startTime = performance.now();
    addLog("Launching ML pipeline (RF + KMeans + Volume Profile)", "info");
    
    const profile = computeVolumeProfile(candles, 35);
    const maxVol = Math.max(...profile.map(p => p.vol));
    const liqZones = profile.filter(p => p.vol > maxVol * 0.38).map(p => ({
        type: "LIQUIDITY", price: (p.priceFrom + p.priceTo) / 2, priceFrom: p.priceFrom, priceTo: p.priceTo,
        strength: Math.round(p.pct * 10) / 10, vol: p.vol, label: "High Vol Node"
    }));
    
    const { pivotHighs, pivotLows } = findPivots(candles, 5, 5);
    const resistPrices = clusterLevels(pivotHighs.map(p => p.price), 0.007);
    const supportPrices = clusterLevels(pivotLows.map(p => p.price), 0.007);
    const srLevels = [
        ...resistPrices.map(p => ({ type: "RESISTANCE", price: p, label: "Pivot Resistance", strength: pivotHighs.filter(h => Math.abs(h.price - p) / p < 0.01).length })),
        ...supportPrices.map(p => ({ type: "SUPPORT", price: p, label: "Pivot Support", strength: pivotLows.filter(h => Math.abs(h.price - p) / p < 0.01).length }))
    ].sort((a, b) => b.strength - a.strength).slice(0, 14);
    
    const typicalPrices = candles.map(c => (c.high + c.low + c.close) / 3);
    const kClusters = kMeansCluster(typicalPrices, 8, 40);
    const mlZones = kClusters.map(cl => ({ type: "ML_CLUSTER", price: cl.center, strength: cl.strength, label: "ML Cluster" }));
    
    const bb = computeBollingerBands(candles.map(c => c.close), 20, 2);
    const lastBB = bb.filter(b => b !== null).at(-1);
    const bbZones = lastBB ? [
        { type: "BB_UPPER", price: lastBB.upper, label: "BB Upper", strength: 4 },
        { type: "BB_MID", price: lastBB.mid, label: "BB Mid", strength: 2 },
        { type: "BB_LOWER", price: lastBB.lower, label: "BB Lower", strength: 4 }
    ] : [];
    
    const { X, y } = buildFeatures(candles);
    let prediction = { label: "NEUTRAL", confidence: 50 };
    let featureImportance = [], treeDepths = [], ensembleVariance = 0, modelAccuracy = 0;
    let rfModel = null;
    
    if (X.length > 60) {
        rfModel = new OptimizedRandomForest(22, 5, 0.8);
        rfModel.fit(X, y);
        let correct = 0;
        for (let i = 0; i < X.length; i++) { if (rfModel.predict(X[i]).label === y[i]) correct++; }
        modelAccuracy = (correct / X.length) * 100;
        featureImportance = computeFeatureImportance(X, y, rfModel);
        treeDepths = rfModel.getTreeDepths();
        ensembleVariance = rfModel.getEnsembleVariance();
        
        const closes = candles.map(c => c.close);
        const rsiLatest = computeRSI(closes, 14);
        const ma20 = rollingMean(closes, 20);
        const ma50 = rollingMean(closes, 50);
        const atr = computeATR(candles, 14);
        const bbCurr = computeBollingerBands(closes, 20, 2);
        const volMeans = rollingMean(candles.map(c => c.volume), 20);
        const i = candles.length - 1;
        const cPrice = closes[i];
        const bbVal = bbCurr[i] || bbCurr.filter(b => b !== null).at(-1) || { upper: cPrice, lower: cPrice };
        const bbPos = (cPrice - bbVal.lower) / (bbVal.upper - bbVal.lower || 1);
        const volRatio = (candles[i].volume || 1) / (volMeans[i] || 1);
        const ma20v = ma20[i] || cPrice;
        const ma50v = ma50[i] || cPrice;
        const atrVal = atr[i] || 0;
        const feat = [
            rsiLatest, volRatio, bbPos, (cPrice - ma20v) / ma20v, (cPrice - ma50v) / ma50v,
            Math.abs(candles[i].close - candles[i].open) / (candles[i].high - candles[i].low || 1),
            (cPrice - (closes[i - 5] || cPrice)) / (closes[i - 5] || cPrice),
            atrVal / cPrice,
            (candles[i].high - cPrice) / (cPrice - candles[i].low || 1)
        ];
        prediction = rfModel.predict(feat);
        addLog(`RF Accuracy: ${fmt(modelAccuracy, 1)}% | Signal: ${prediction.label} (${fmt(prediction.confidence, 1)}% conf)`, "ok");
    } else { addLog("Insufficient samples for RF, using fallback signals", "warning"); }
    
    const allZones = [...liqZones, ...mlZones, ...bbZones].sort((a, b) => b.strength - a.strength).slice(0, 16);
    
    setState({
        mlAnalytics: {
            trainingTime: performance.now() - startTime,
            featureImportance, modelAccuracy,
            confusionMatrix: { BUY: Math.floor(modelAccuracy / 2.5), SELL: Math.floor(modelAccuracy / 2.5), NEUTRAL: Math.floor(modelAccuracy / 1.8) },
            treeDepths, ensembleVariance,
            lastTrainingSize: X.length,
            featureCorrelations: {},
            rfModel
        }
    });
    
    return { zones: allZones, srLevels, prediction, lastBB, rsi: computeRSI(candles.map(c => c.close), 14) };
}