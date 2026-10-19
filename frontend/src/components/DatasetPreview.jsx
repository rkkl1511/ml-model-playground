import { motion } from "framer-motion";
import CountUp from "./CountUp";

const kindStyle = {
    numeric: "border-neon-cyan/40 text-neon-cyan",
    categorical: "border-neon-pink/40 text-neon-pink",
};

function formatCell(value) {
    if (typeof value === "number") {
        return Number.isInteger(value) ? value : Number(value.toFixed(4));
    }
    return String(value);
}

export default function DatasetPreview({ dataset }) {
    const { name, rows, columns, preview, suggested_target } = dataset;

    const numeric = columns.filter((c) => c.kind === "numeric").length;
    const missing = columns.reduce((sum, c) => sum + c.missing, 0);

    const stats = [
        { label: "Rows", value: rows },
        { label: "Columns", value: columns.length },
        { label: "Numeric columns", value: numeric },
        { label: "Missing cells", value: missing },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="mt-14"
        >
            <h3 className="font-display text-2xl font-bold">
                <span className="text-gradient">{name}</span>
            </h3>
            <p className="mt-1 text-sm text-slate-400">
                Suggested target column: <span className="text-slate-200">{suggested_target}</span>{" "}
                (you'll choose in the next steps)
            </p>

            {/* Stat cards */}
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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
            </div>

            {/* Column chips */}
            <div className="mt-8">
                <div className="mb-3 text-xs uppercase tracking-widest text-slate-400">Columns</div>
                <div className="flex flex-wrap gap-2">
                    {columns.map((c, i) => (
                        <motion.span
                            key={c.name}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + i * 0.02 }}
                            title={`${c.dtype} · ${c.unique} unique · ${c.missing} missing`}
                            className={`rounded-full border bg-white/[0.03] px-3 py-1 text-xs ${kindStyle[c.kind]}`}
                        >
                            {c.name}
                        </motion.span>
                    ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                    <span className="text-neon-cyan">Cyan</span> = numeric ·{" "}
                    <span className="text-neon-pink">Pink</span> = categorical (text). Hover a chip for details.
                </p>
            </div>

            {/* Preview table */}
            <div className="mt-8">
                <div className="mb-3 text-xs uppercase tracking-widest text-slate-400">
                    First {preview.length} rows
                </div>
                <div className="glass overflow-x-auto rounded-2xl">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                                {columns.map((c) => (
                                    <th key={c.name} className="whitespace-nowrap px-4 py-3 font-medium">
                                        {c.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.map((row, i) => (
                                <motion.tr
                                    key={i}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + i * 0.05 }}
                                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.04]"
                                >
                                    {columns.map((c) => {
                                        const value = row[c.name];
                                        return (
                                            <td key={c.name} className="whitespace-nowrap px-4 py-2.5 text-slate-300">
                                                {value === null || value === undefined ? (
                                                    <span className="italic text-rose-300/70">missing</span>
                                                ) : (
                                                    formatCell(value)
                                                )}
                                            </td>
                                        );
                                    })}
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
}