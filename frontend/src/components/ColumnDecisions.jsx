import { motion } from "framer-motion";
import Panel from "./Panel";

const kindStyle = {
    numeric: "border-neon-cyan/40 text-neon-cyan",
    categorical: "border-neon-pink/40 text-neon-pink",
    empty: "border-white/10 text-slate-500",
};

/**
 * Shows what the parser decided about every column, so nothing happens
 * behind the user's back. "Max Power" was text; now it is a number in kW,
 * and this is where you find out why.
 */
export default function ColumnDecisions({ columns, leaked = [] }) {
    if (!columns || columns.length === 0) return null;

    const leakedSet = new Set(leaked);

    return (
        <Panel
            title="What we found in each column"
            subtitle="Every column, and what we did with it."
            className="mt-6"
        >
            <div className="space-y-3">
                {columns.map((col, i) => {
                    const leakedCol = leakedSet.has(col.name);
                    const notes = col.notes || [];
                    const variants = col.variants || [];

                    return (
                        <motion.div
                            key={col.name}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: Math.min(i * 0.04, 0.4) }}
                            className={`rounded-xl border px-4 py-3 ${leakedCol
                                    ? "border-rose-400/30 bg-rose-500/5"
                                    : "border-white/10 bg-white/[0.02]"
                                }`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{col.name}</span>
                                <span
                                    className={`rounded-full border px-2 py-0.5 text-[10px] ${kindStyle[col.kind] || ""}`}
                                >
                                    {col.kind === "numeric" ? "read as numbers" : "read as labels"}
                                </span>
                                {col.unit && (
                                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                                        unit: {col.unit}
                                        {col.base_unit && col.base_unit !== col.unit
                                            ? ` → ${col.base_unit}`
                                            : ""}
                                    </span>
                                )}
                                {col.mixed && (
                                    <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-300">
                                        mixed units → split
                                    </span>
                                )}
                                {leakedCol && (
                                    <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] text-rose-300">
                                        leaks the target → dropped
                                    </span>
                                )}
                            </div>

                            {col.kind === "numeric" && col.parse_ratio < 1 && (
                                <p className="mt-1.5 text-xs text-slate-400">
                                    {Math.round(col.parse_ratio * 100)}% of the values were read as
                                    numbers, with the units and symbols taken off.
                                </p>
                            )}

                            {variants.length > 0 && (
                                <p className="mt-1.5 text-xs text-slate-400">
                                    Folded together:{" "}
                                    {variants
                                        .slice(0, 3)
                                        .map((group) =>
                                            group.variants.map((v) => v.value).join(" / ")
                                        )
                                        .join(" · ")}
                                </p>
                            )}

                            {notes.map((note) => (
                                <p key={note.title} className="mt-1.5 text-xs text-slate-400">
                                    <span className="text-amber-300">{note.title}:</span>{" "}
                                    {note.text}
                                </p>
                            ))}
                        </motion.div>
                    );
                })}
            </div>
        </Panel>
    );
}
