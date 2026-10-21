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

/**
 * The colour of one cell of a confusion matrix.
 *
 * Cyan on the diagonal for the right answers, pink off it for the
 * mistakes. The two are scaled separately on purpose: if the correct
 * answers set the scale, every mistake looks like zero, which is exactly
 * the thing you came to look at.
 */
export function confusionCell(value, isRight, maxRight, maxWrong) {
    if (!value) {
        return { background: "rgba(255,255,255,0.03)", color: "rgba(148,163,184,0.45)" };
    }
    if (isRight) {
        const intensity = maxRight > 0 ? value / maxRight : 0;
        return {
            background: `rgba(34, 211, 238, ${0.12 + 0.6 * intensity})`,
            color: "#06202a",
        };
    }
    const intensity = maxWrong > 0 ? value / maxWrong : 0;
    return {
        background: `rgba(244, 114, 182, ${0.18 + 0.72 * intensity})`,
        color: "#2b0716",
    };
}
