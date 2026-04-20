export let state = {
    tab: "ml", menuOpen: false,
    apiKey: "", apiSecret: "", connected: false, loading: false,
    candles: null, livePrice: null, priceChange: 0,
    zones: [], srLevels: [], predictions: null,
    modelStatus: "idle",
    selectedInterval: "1h",
    fetchStatus: null,
    walletBalance: 10000,
    logs: [],
    currentSymbol: "BTCUSDT",
    lastFetchedAt: null,
    usingMockData: false,
    dataSource: "",
    mlAnalytics: {
        trainingTime: 0,
        featureImportance: [],
        modelAccuracy: 0,
        confusionMatrix: { BUY: 0, SELL: 0, NEUTRAL: 0 },
        treeDepths: [],
        ensembleVariance: 0,
        lastTrainingSize: 0,
        featureCorrelations: {},
        rfModel: null,
        featureCache: null
    }
};

let listeners = [];

export function setState(patch) { state = { ...state, ...patch }; listeners.forEach(fn => fn()); }

export function addListener(fn) { listeners.push(fn); }

export function addLog(msg, t = "info") { 
    state.logs = [{ msg, t, ts: new Date().toLocaleTimeString("en-US", { hour12: false }) }, ...state.logs.slice(0, 49)]; 
}

export function showFetchStatus(msg, ok = true) { 
    setState({ fetchStatus: { msg, ok } }); 
    setTimeout(() => setState({ fetchStatus: null }), 3000); 
}