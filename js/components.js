import { C, TABS } from './constants.js';
import { state } from './state.js';
import { fmt, fmtPct } from './utils.js';

export function SectionHeader(title, sub = "") {
    return `
        <div style="margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:3px;height:14px;background:${C.red};border-radius:1px;"></div>
                <span style="font-weight:700;font-size:13px;">${title}</span>
            </div>
            ${sub ? `<div style="font-size:10px;color:${C.textLight};margin-top:2px;padding-left:11px;">${sub}</div>` : ""}
        </div>
    `;
}

export function DataRow(label, val, color = null, bold = false) {
    return `
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid ${C.borderLight};">
            <span style="font-size:11px;color:${C.textMid};">${label}</span>
            <span style="font-size:12px;font-family:'Courier New',monospace;font-weight:${bold ? 700 : 400};color:${color || C.text};">${val}</span>
        </div>
    `;
}

export function Tag(label, variant = "neutral") {
    const styles = {
        up: { bg: C.greenBg, color: C.green },
        down: { bg: C.redLight, color: C.red },
        warning: { bg: C.amberBg, color: C.amber },
        neutral: { bg: "#ebebeb", color: C.textMid },
        info: { bg: "#e3eefa", color: C.blue },
        ml: { bg: "#ede8f5", color: C.purple }
    };
    const s = styles[variant] || styles.neutral;
    return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.bg};font-size:9px;font-weight:700;padding:2px 6px;border-radius:2px;">${label}</span>`;
}

export function MiniMeter(conf, label) {
    const color = conf > 70 ? C.green : (conf > 50 ? C.amber : C.red);
    return `
        <div style="background:#f4f4f4;padding:8px;text-align:center;">
            <div style="font-size:18px;font-weight:700;color:${color};">${fmt(conf, 0)}%</div>
            <div style="font-size:9px;">${label}</div>
            <div class="progress-bar"><div class="progress-fill" style="width:${conf}%;background:${color};"></div></div>
        </div>
    `;
}

export function ZoneTypeColor(type) {
    const types = {
        SUPPORT: { color: C.green, bg: C.greenBg, label: "SUP" },
        RESISTANCE: { color: C.red, bg: C.redLight, label: "RES" },
        LIQUIDITY: { color: C.blue, bg: "#e3eefa", label: "LIQ" },
        ML_CLUSTER: { color: C.purple, bg: "#ede8f5", label: "ML" },
        BB_UPPER: { color: C.red, bg: C.redLight, label: "BB↑" },
        BB_MID: { color: C.amber, bg: C.amberBg, label: "BB~" },
        BB_LOWER: { color: C.green, bg: C.greenBg, label: "BB↓" }
    };
    return types[type] || { color: C.textMid, bg: "#ebebeb", label: "ZN" };
}

export function PriceZoneChart({ candles, zones, srLevels, livePrice }) {
    if (!candles || candles.length < 2) return `<div style="padding:32px;text-align:center;">No data</div>`;
    
    const recent = candles.slice(-80);
    const allPrices = [...recent.flatMap(c => [c.high, c.low]), ...(zones || []).map(z => z.price), ...(srLevels || []).map(z => z.price), livePrice || 0];
    const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
    const range = maxP - minP || 1;
    const W = 440, H = 240;
    const toY = p => ((maxP - p) / range) * (H - 30) + 12;
    const cw = (W - 20) / recent.length;
    
    let svg = `<svg width="${W}" height="${H}" style="background:${C.white}"><rect width="${W}" height="${H}" fill="#fafafa"/>`;
    
    (srLevels || []).slice(0, 6).forEach(z => {
        const yp = toY(z.price);
        svg += `<line x1="0" y1="${yp}" x2="${W}" y2="${yp}" stroke="${z.type === "RESISTANCE" ? C.red : C.green}" stroke-width="0.8" stroke-dasharray="5,3" opacity="0.6"/>`;
    });
    
    recent.forEach((c, i) => {
        const x = 10 + i * cw + cw * 0.1, bw = Math.max(cw * 0.65, 2);
        const isUp = c.close >= c.open, color = isUp ? C.green : C.red;
        svg += `<line x1="${x + bw / 2}" y1="${toY(c.high)}" x2="${x + bw / 2}" y2="${toY(c.low)}" stroke="${color}" stroke-width="1"/>
                <rect x="${x}" y="${toY(Math.max(c.open, c.close))}" width="${bw}" height="${Math.max(toY(Math.min(c.open, c.close)) - toY(Math.max(c.open, c.close)), 1)}" fill="${color}" rx="0.5"/>`;
    });
    
    if (livePrice) {
        const yL = toY(livePrice);
        svg += `<line x1="0" y1="${yL}" x2="${W}" y2="${yL}" stroke="${C.red}" stroke-width="1.8"/>
                <rect x="${W - 70}" y="${yL - 9}" width="68" height="16" fill="${C.red}" rx="2"/>
                <text x="${W - 66}" y="${yL + 3}" fill="white" font-size="9" font-weight="700">${Math.round(livePrice).toLocaleString()}</text>`;
    }
    
    return svg + `</svg>`;
}

export function MLAnalyticsDashboard() {
    const a = state.mlAnalytics;
    if (!a.lastTrainingSize || state.modelStatus !== "ready") return `<div style="background:${C.white};border:1px solid ${C.border};border-radius:2px;padding:20px;text-align:center;">Run analysis first</div>`;
    
    return `
        <div style="background:${C.white};border:1px solid ${C.border};border-radius:2px;padding:14px;">
            ${SectionHeader("Model Metrics", "22-Tree Forest · MaxDepth 5")}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div style="background:#f4f4f4;padding:10px;text-align:center;">
                    <div style="font-size:10px;">Accuracy</div>
                    <div class="metric-value" style="font-size:20px;color:${a.modelAccuracy > 70 ? C.green : C.amber};">${fmt(a.modelAccuracy, 1)}%</div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${a.modelAccuracy}%;background:${C.purple};"></div></div>
                </div>
                <div style="background:#f4f4f4;padding:10px;text-align:center;">
                    <div style="font-size:10px;">Train Time</div>
                    <div class="metric-value" style="font-size:20px;">${fmt(a.trainingTime, 0)}ms</div>
                    <div style="font-size:9px;">${a.lastTrainingSize} samples</div>
                </div>
            </div>
            ${SectionHeader("Feature Importance")}
            ${a.featureImportance.slice(0, 5).map(f => `
                <div><div style="display:flex;justify-content:space-between;"><span style="font-size:10px;">${f.name}</span><span>${fmt(f.importance, 1)}%</span></div>
                <div class="progress-bar"><div class="progress-fill" style="width:${f.importance}%;background:${C.blue};"></div></div></div>
            `).join("")}
        </div>
    `;
}

export function renderMLTab() {
    return `
        <div style="background:${C.white};padding:14px;margin-bottom:12px;">
            <div style="font-size:26px;font-weight:700;">${state.livePrice ? `$${Math.round(state.livePrice).toLocaleString()}` : "Loading..."}</div>
            <div>${state.priceChange ? fmtPct(state.priceChange) : ""}</div>
            <button id="fetchBtn" class="k-btn" style="background:${C.red};color:white;width:100%;padding:12px;">${state.loading ? "ML Training..." : "Predict Now"}</button>
        </div>
        ${state.modelStatus === "ready" && state.predictions ? `
            <div style="background:white;border-left:4px solid ${state.predictions.label === "BUY" ? C.green : state.predictions.label === "SELL" ? C.red : C.amber};padding:14px;margin-bottom:12px;">
                ${SectionHeader("Random Forest Signal")}
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                    ${MiniMeter(state.predictions.confidence || 50, "RF Confidence")}
                    ${MiniMeter(state.mlAnalytics.modelAccuracy || 0, "Model Accuracy")}
                    ${MiniMeter((state.zones?.length || 0) * 10, "Zone Strength")}
                </div>
                <div style="background:${state.predictions.label === "BUY" ? C.greenBg : state.predictions.label === "SELL" ? C.redLight : C.amberBg};padding:10px;margin-top:10px;">
                    <div style="font-weight:700;font-size:18px;">${state.predictions.label}</div>
                </div>
                ${DataRow("RSI (14)", fmt(state.rsi || 50, 1))}
                ${DataRow("Zones detected", (state.zones?.length || 0) + (state.srLevels?.length || 0))}
            </div>
        ` : ""}
        ${state.zones?.length ? `
            <div style="background:white;padding:14px;">
                ${SectionHeader("Liquidity Zones", "K-Means + Volume Profile")}
                ${state.zones.slice(0, 7).map(z => {
                    const zc = ZoneTypeColor(z.type);
                    const dist = state.livePrice ? ((z.price - state.livePrice) / state.livePrice * 100) : 0;
                    return `
                        <div style="display:flex;justify-content:space-between;padding:7px 0;">
                            <div><div style="background:${zc.bg};display:inline-block;padding:2px 6px;font-size:9px;">${zc.label}</div><div style="font-size:10px;">${z.label}</div></div>
                            <div style="text-align:right;"><div style="font-weight:700;">${Math.round(z.price).toLocaleString()}</div><div style="font-size:9px;color:${dist >= 0 ? C.green : C.red};">${fmtPct(dist)}</div></div>
                        </div>
                    `;
                }).join("")}
            </div>
        ` : ""}
    `;
}