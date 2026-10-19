import { motion } from "framer-motion";
import CountUp from "./CountUp";
import Panel from "./Panel";

const levelStyle = {
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    info: "border-neon-cyan/30 bg-neon-cyan/10 text-cyan-200",
};

function fmt(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isInteger(value) ? value : Number(value.toFixed(3));
    return String(value);
}

function MiniTable({ columns, rows, hidden = 0 }) {
    return (
        <div>
            <div className="glass overflow-x-auto rounded-xl">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                            {columns.map((c) => (
                                <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="border-b border-white/5 last:border-0">
                                {row.map((cell, j) => {
                                    const value = fmt(cell);
                                    return (
                                        <td key={j} className="whitespace-nowrap px-3 py-2 text-slate-300">
                                            {value === null ? (
                                                <span className="italic text-rose-300/80">missing</span>
                                            ) : (
                                                value
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hidden > 0 && <p className="mt-2 text-xs text-slate-500">+ {hidden} more columns not shown</p>}
        </div>
    );
}

export default function PrepResult({ result, stale }) {
    const stats = [
        { label: "Training rows", value: result.train_rows },
        { label: "Test rows", value: result.test_rows },
        { label: "Classes", value: result.n_classes },
    ];
    const maxClass = Math.max(...result.class_split.map((c) => c.train + c.test), 1);

    // Raw rows are objects keyed by column name; the tables want arrays of cells
    const beforeRows = result.before.rows.map((r) => result.before.columns.map((c) => r[c]));

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: stale ? 0.55 : 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-10"
        >
            <div className="mb-6 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                    ✓
                </span>
                <div>
                    <div className="font-display text-xl font-bold">Your data is ready for training</div>
                    <div className="text-sm text-slate-400">
                        {stale ? "These results are out of date. Prepare again to refresh." : "Here's exactly what happened."}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {stats.map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.08 }}
                        className="glass rounded-2xl p-5"
                    >
                        <div className="text-xs uppercase tracking-widest text-slate-400">{s.label}</div>
                        <div className="mt-1 font-display text-4xl font-bold">
                            <CountUp to={s.value} />
                        </div>
                    </motion.div>
                ))}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.24 }}
                    className="glass rounded-2xl p-5"
                >
                    <div className="text-xs uppercase tracking-widest text-slate-400">Features</div>
                    <div className="mt-1 font-display text-4xl font-bold">
                        <CountUp to={result.features_before} />
                        <span className="mx-2 text-slate-500">→</span>
                        <span className="text-gradient">
                            <CountUp to={result.features_after} />
                        </span>
                    </div>
                </motion.div>
            </div>

            {result.warnings.length > 0 && (
                <div className="mt-6 space-y-3">
                    {result.warnings.map((w) => (
                        <div key={w.title} className={`rounded-xl border px-4 py-3 text-sm ${levelStyle[w.level]}`}>
                            <div className="font-semibold">{w.title}</div>
                            <div className="mt-0.5 text-slate-300">{w.text}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Panel title="What we did" subtitle="In order, with the reason for each step." className="h-full">
                    <ol className="relative ml-3 border-l border-white/10">
                        {result.steps.map((s, i) => (
                            <motion.li
                                key={s.key}
                                initial={{ opacity: 0, x: -16 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="relative mb-6 ml-6 last:mb-0"
                            >
                                <span className="absolute -left-9 grid h-6 w-6 place-items-center rounded-full bg-linear-to-br from-neon-violet to-neon-cyan text-xs font-bold">
                                    {i + 1}
                                </span>
                                <div className="font-semibold">{s.title}</div>
                                <div className="mt-0.5 text-sm text-slate-300">{s.detail}</div>
                                <div className="mt-1 text-xs italic text-slate-500">Why: {s.why}</div>
                            </motion.li>
                        ))}
                    </ol>
                </Panel>

                <Panel
                    title="Split by class"
                    subtitle={
                        result.stratified
                            ? "Stratified: every class is split in the same ratio."
                            : "Random split: class ratios may differ between train and test."
                    }
                    className="h-full"
                >
                    <div className="mb-4 flex gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-neon-violet" /> Train
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-sm bg-neon-pink" /> Test
                        </span>
                    </div>
                    <div className="space-y-4">
                        {result.class_split.map((c, i) => (
                            <div key={c.label}>
                                <div className="mb-1 flex justify-between gap-3 text-sm">
                                    <span className="truncate text-slate-300">{c.label}</span>
                                    <span className="shrink-0 text-slate-400">
                                        {c.train} train · {c.test} test
                                    </span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                                    <motion.div
                                        className="flex h-full"
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${((c.train + c.test) / maxClass) * 100}%` }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                                    >
                                        <div className="h-full bg-neon-violet" style={{ flex: c.train }} />
                                        <div className="h-full bg-neon-pink" style={{ flex: c.test }} />
                                    </motion.div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>
            </div>

            <Panel
                title="Before and after"
                subtitle="The same first training rows. Raw on top, model-ready below."
                className="mt-6"
            >
                <div className="space-y-6">
                    <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Before (raw)</div>
                        <MiniTable columns={result.before.columns} rows={beforeRows} />
                    </div>
                    <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-neon-cyan">After (numbers only)</div>
                        <MiniTable
                            columns={result.after.columns}
                            rows={result.after.rows}
                            hidden={result.after.hidden_columns}
                        />
                    </div>
                </div>
            </Panel>
        </motion.div>
    );
}