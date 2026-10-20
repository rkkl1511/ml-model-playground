import { motion } from "framer-motion";
import Panel from "./Panel";

const taskStyle = {
    classification: "bg-neon-cyan/15 text-neon-cyan",
    regression: "bg-neon-pink/15 text-neon-pink",
};

/**
 * Lets the user pick any column as the target, not just the ones that
 * happen to have a friendly number of classes. The backend suggests which
 * columns look like good targets and says why, but the choice stays with
 * the user.
 */
export default function TargetPicker({ dataset, task, onTask, value, onChange }) {
    const columns = dataset.columns || [];
    const suggestions = dataset.target_suggestions || [];
    const suggested = new Set(suggestions.map((s) => s.name));

    return (
        <Panel
            title="1. What do you want to predict?"
            subtitle="Pick any column. We will work out the rest."
        >
            <div className="space-y-5">
                {/* The suggestions, ranked, each with a reason. */}
                {suggestions.length > 0 && (
                    <div>
                        <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                            Good candidates
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s) => {
                                const active = s.name === value;
                                return (
                                    <motion.button
                                        key={s.name}
                                        type="button"
                                        onClick={() => onChange(s.name)}
                                        whileHover={{ y: -2 }}
                                        whileTap={{ scale: 0.97 }}
                                        title={s.detail}
                                        className={`rounded-full border px-3 py-1.5 text-xs transition ${active
                                                ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
                                                : "border-white/10 text-slate-300 hover:border-white/25"
                                            }`}
                                    >
                                        {s.name}
                                        <span
                                            className={`ml-2 rounded-full px-1.5 py-0.5 text-[9px] uppercase ${taskStyle[s.task] || ""}`}
                                        >
                                            {s.task === "regression" ? "number" : "label"}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Every column, so nothing is off limits. */}
                <div>
                    <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                        All {columns.length} columns
                    </div>
                    <select
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-slate-200 outline-none focus:border-neon-violet"
                    >
                        {columns.map((c) => (
                            <option key={c.name} value={c.name}>
                                {c.name} — {c.kind === "numeric" ? "numbers" : "labels"}
                                {suggested.has(c.name) ? " (suggested)" : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Classification or regression? */}
                <div>
                    <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                        What kind of answer?
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            {
                                value: "classification",
                                label: "A label",
                                hint: "One of a fixed set: yes/no, red/blue, a species.",
                            },
                            {
                                value: "regression",
                                label: "A number",
                                hint: "A quantity: a price, a temperature, a count.",
                            },
                            {
                                value: "auto",
                                label: "Decide for me",
                                hint: "We look at the column and pick the sensible one.",
                            },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onTask(option.value)}
                                title={option.hint}
                                className={`rounded-xl border px-4 py-2 text-sm transition ${task === option.value
                                        ? "border-neon-violet bg-neon-violet/15 text-white"
                                        : "border-white/10 text-slate-300 hover:border-white/25"
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        {task === "auto"
                            ? "We will look at the target column and choose."
                            : task === "regression"
                                ? "A number to predict. We'll score with R-squared and error in the same units."
                                : "A label to predict. We'll score with accuracy, precision, recall and F1."}
                    </p>
                </div>
            </div>
        </Panel>
    );
}
