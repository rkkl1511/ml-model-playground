// Compact, readable numbers for axes and stat tiles
export function fmtNum(n) {
    if (n === null || n === undefined) return "-";
    const a = Math.abs(n);
    if (a === 0) return "0";
    if (a < 0.01) return n.toExponential(1);
    if (a >= 1000) return Math.round(n).toLocaleString();
    if (a >= 100) return n.toFixed(0);
    if (a >= 10) return n.toFixed(1);
    return n.toFixed(2);
}