export const fmt = (n, d = 2) => Number(n || 0).toFixed(d);
export const fmtK = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (n) => (n >= 0 ? "+" : "") + Number(n || 0).toFixed(2) + "%";
export const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false });

export function rollingMean(arr, w) {
    const res = new Array(arr.length).fill(null);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        if (i >= w) sum -= arr[i - w];
        if (i >= w - 1) res[i] = sum / w;
    }
    return res;
}

export function rollingStd(arr, w, means) {
    const res = new Array(arr.length).fill(null);
    for (let i = w - 1; i < arr.length; i++) {
        let sqSum = 0;
        for (let j = i - w + 1; j <= i; j++) sqSum += (arr[j] - means[i]) ** 2;
        res[i] = Math.sqrt(sqSum / w);
    }
    return res;
}