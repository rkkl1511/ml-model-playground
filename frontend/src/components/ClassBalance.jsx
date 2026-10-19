import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";

const COLORS = ["#8b5cf6", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

const toneStyle = {
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    mid: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bad: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function verdict(balance) {
    const top = balance.counts[0];
    if (balance.imbalance_ratio < 1.5) {
        return { tone: "good", text: "Well balanced. Accuracy is a fair score here." };
    }
    if (balance.imbalance_ratio < 3) {
        return { tone: "mid", text: "Slightly imbalanced. Watch the per-class scores, not just accuracy." };
    }
    return {
        tone: "bad",
        text: `Imbalanced. A model that always guesses "${top.label}" would already be ${balance.majority_pct}% accurate, so accuracy alone can mislead.`,
    };
}

export default function ClassBalance({ columns, defaultTarget }) {
    // Any column with 2-20 distinct values could be a label to predict
    const candidates = columns.filter((c) => c.balance);
    const initial =
        candidates.find((c) => c.name === defaultTarget)?.name ?? candidates[0]?.name ?? "";
    const [target, setTarget] = useState(initial);

    const col = candidates.find((c) => c.name === target);

    return (
        <Panel
            title="Class balance"
            subtitle="If one class dominates, a lazy model can look smart."
            className="h-full"
        >
            {!col ? (
                <p className="text-sm text-slate-400">
                    No column looks like a class label (we look for columns with 2 to 20 distinct values).
                </p>
            ) : (
                <>
                    <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="mb-5 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-slate-200 outline-none focus:border-neon-violet"
                    >
                        {candidates.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <div className="space-y-4">
                        {col.balance.counts.map((row, i) => (
                            <div key={`${target}-${row.label}`}>
                                <div className="mb-1 flex justify-between gap-3 text-sm">
                                    <span className="truncate text-slate-300">{row.label}</span>
                                    <span className="shrink-0 text-slate-400">
                                        {row.count} · {row.pct}%
                                    </span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${(row.count / col.balance.counts[0].count) * 100}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                                        className="h-full rounded-full"
                                        style={{ background: COLORS[i % COLORS.length] }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {(() => {
                        const v = verdict(col.balance);
                        return (
                            <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${toneStyle[v.tone]}`}>
                                {v.text}
                            </p>
                        );
                    })()}
                </>
            )}
        </Panel>
    );
}