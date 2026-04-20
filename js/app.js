import { C, TABS } from './constants.js';
import { state, setState, addListener, addLog, showFetchStatus } from './state.js';
import { fetchBinanceCandles, fetchBinanceTicker, generateRealisticMockData } from './api.js';
import { runMLPipeline } from './pipeline.js';
import { Tag, SectionHeader, DataRow, PriceZoneChart, MLAnalyticsDashboard, renderMLTab } from './components.js';

async function fetchAndAnalyze() {
    setState({ modelStatus: "training", loading: true });
    addLog(`Fetching ${state.currentSymbol} ${state.selectedInterval} from Binance...`, "info");
    
    let candles = await fetchBinanceCandles(state.currentSymbol, state.selectedInterval, 350);
    let dataSource = "Binance", usingMock = false;
    
    if (!candles || candles.length < 30) {
        addLog("Binance fallback -> using high-fidelity simulated data", "warning");
        candles = generateRealisticMockData(350, 65000);
        dataSource = "Simulated Market (High-Fidelity)";
        usingMock = true;
        showFetchStatus("Simulated mode active - full ML features", false);
    } else {
        addLog(`Loaded ${candles.length} candles from Binance`, "ok");
        showFetchStatus(`Real-time Binance data (${candles.length} bars)`);
    }
    
    let ticker = !usingMock ? await fetchBinanceTicker(state.currentSymbol) : null;
    const livePrice = ticker ? ticker.close : candles[candles.length - 1].close;
    const priceChange = ticker ? ticker.change_24h : (Math.random() - 0.5) * 0.03;
    const result = runMLPipeline(candles);
    
    setState({
        candles, livePrice, priceChange, ...result,
        modelStatus: "ready", loading: false,
        lastFetchedAt: new Date().toLocaleTimeString(),
        usingMockData: usingMock,
        dataSource: dataSource,
        predictions: result.prediction
    });
}

function renderApp() {
    const root = document.getElementById("kryptxRoot");
    if (!root) return;
    
    const html = `
        <div style="background:white;border-bottom:1px solid #d8d8d8;display:flex;justify-content:space-between;padding:0 14px;height:54px;">
            <button id="menuToggleBtn" style="background:none;border:none;font-size:20px;">☰</button>
            <div style="font-weight:700;">KRYPTX · ML TERMINAL</div>
            ${Tag(state.usingMockData ? "DEMO" : "LIVE", state.usingMockData ? "warning" : "up")}
        </div>
        ${state.menuOpen ? `
            <div id="drawerOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:300;">
                <div style="background:white;width:240px;height:100%;padding:20px;">
                    ${TABS.map(t => `<div data-tab="${t.id}" class="drawer-tab" style="padding:12px;cursor:pointer;border-left:${state.tab === t.id ? `3px solid ${C.red}` : "3px solid transparent"};margin-bottom:4px;">${t.label}</div>`).join("")}
                </div>
            </div>
        ` : ""}
        <div style="padding:14px 12px 80px;">
            ${state.tab === "ml" ? renderMLTab() : 
              state.tab === "analytics" ? MLAnalyticsDashboard() : 
              state.tab === "chart" ? `<div style="background:white;padding:14px;">${SectionHeader("Chart + Zones")}<div style="overflow-x:auto;">${PriceZoneChart({candles:state.candles,zones:state.zones,srLevels:state.srLevels,livePrice:state.livePrice})}</div></div>` : 
              state.tab === "sr" ? `<div style="background:white;padding:14px;">${SectionHeader("S/R Levels")}${(state.srLevels||[]).map(z=>`<div style="display:flex;justify-content:space-between;padding:7px 0;"><div>${Tag(z.type==="RESISTANCE"?"RES":"SUP",z.type==="RESISTANCE"?"down":"up")}</div><div style="font-weight:700;">${Math.round(z.price).toLocaleString()}</div></div>`).join("")}</div>` : 
              state.tab === "signals" ? `<div style="background:white;padding:14px;">${SectionHeader("Activity Log")}${state.logs.slice(0,12).map(l=>`<div style="font-size:10px;padding:4px 0;">[${l.ts}] ${l.msg}</div>`).join("")}</div>` : ""}
        </div>
        <div style="position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;background:white;display:flex;border-top:1px solid #d8d8d8;">
            ${TABS.map(t => `<button data-tab="${t.id}" class="bottom-tab" style="flex:1;padding:10px;background:none;border:none;color:${state.tab===t.id?C.red:C.textLight};font-weight:${state.tab===t.id?700:400};">${t.label}</button>`).join("")}
        </div>
    `;
    
    root.innerHTML = html;
    attachEvents();
}

function attachEvents() {
    document.querySelectorAll(".bottom-tab, .drawer-tab").forEach(btn => {
        btn.addEventListener("click", () => { const tab = btn.getAttribute("data-tab"); if (tab) setState({ tab, menuOpen: false }); });
    });
    
    const menu = document.getElementById("menuToggleBtn");
    if (menu) menu.onclick = () => setState({ menuOpen: !state.menuOpen });
    
    const overlay = document.getElementById("drawerOverlay");
    if (overlay) overlay.onclick = () => setState({ menuOpen: false });
    
    const fetchBtn = document.getElementById("fetchBtn");
    if (fetchBtn) fetchBtn.onclick = () => fetchAndAnalyze();
}

addListener(renderApp);
renderApp();
setTimeout(() => fetchAndAnalyze(), 300);

window.__kryptx_setInterval = (iv) => setState({ selectedInterval: iv });