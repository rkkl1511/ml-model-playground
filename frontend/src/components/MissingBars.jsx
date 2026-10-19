import { motion } from "framer-motion";
import Panel from "./Panel";

export default function MissingBars({ columns }) {
    const gaps = columns
        .filter((c) => c.missing > 0)
        .sort((a, b) => b.missing_pct - a.missing_pct)
        .slice(0, 10);

    return (
        <Panel
            title="Missing values"
            subtitle="Empty cells per column. Models can't learn from a blank."
            className="h-full"
        >
            {gaps.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-400/10 px-4 py-6 text-emerald-200">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-400/20">✓</span>
                    No missing values. Nothing to fix here.
                </div>
            ) : (
                <div className="space-y-4">
                    {gaps.map((c, i) => (
                        <div key={c.name}>
                            <div className="mb-1 flex justify-between gap-3 text-sm">
                                <span className="truncate text-slate-300">{c.name}</span>
                                <span className="shrink-0 text-slate-400">
                                    {c.missing} ({c.missing_pct}%)
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${Math.max(c.missing_pct, 1.5)}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.9, delay: i * 0.08, ease: "easeOut" }}
                                    className={`h-full rounded-full ${c.missing_pct > 30 ? "bg-rose-400" : "bg-amber-400"}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}