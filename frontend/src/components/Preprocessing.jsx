import { useState } from "react";
import { motion } from "framer-motion";
import { preprocess } from "../api";
import Panel from "./Panel";
import Segmented from "./Segmented";
import PrepResult from "./PrepResult";
import TargetPicker from "./TargetPicker";

const scalingHelp = {
    standard: "Shifts each column to mean 0 and spread 1. The usual default.",
    minmax: "Squeezes each column into the range 0 to 1.",
    none: "Leaves numbers as they are. Fine for tree models, risky for KNN and logistic regression.",
};

const cardinalityHelp = {
    group_rare:
        "Values that appear only a few times are rolled into one 'other' bucket. A thousand one-off names become a handful of useful columns.",
    drop: "A column with hundreds of one-off values is left out entirely.",
    keep: "Every value gets its own column. Honest, but it can make a thousand almost-empty columns.",
};

// IDs (unique on every row) and constant columns are pre-selected to be
// dropped. A feature that is different on every row teaches nothing except
// how to memorise the row, so it is almost always a key.
function suggestDrops(dataset, target) {
    return (dataset.columns || [])
        .filter(
            (c) =>
                c.name !== target &&
                (c.unique <= 1 ||
                    (c.unique === dataset.rows && c.name !== target))
        )
        .map((c) => c.name);
}

function Label({ title, hint }) {
    return (
        <div className="mb-2">
            <div className="text-sm font-semibold text-slate-200">{title}</div>
            {hint && <div className="text-xs text-slate-500">{hint}</div>}
        </div>
    );
}

export default function Preprocessing({ dataset, onPrepared }) {
    const columns = dataset.columns || [];
    const suggestions = dataset.target_suggestions || [];
    const firstTarget =
        suggestions.find((s) => s.name === dataset.suggested_target)?.name ??
        suggestions[0]?.name ??
        columns[0]?.name ??
        "";

    const [config, setConfig] = useState({
        target: firstTarget,
        task: "auto",
        dropped: suggestDrops(dataset, firstTarget),
        numericImpute: "median",
        categoricalImpute: "most_frequent",
        scaling: "standard",
        testSize: 0.2,
        stratify: true,
        randomState: 42,
        highCardinality: "group_rare",
        maxCategories: 50,
        rareThreshold: 20,
        parseNumbers: true,
        dropLeaky: true,
    });
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stale, setStale] = useState(false);

    function update(patch) {
        setConfig((c) => {
            const next = { ...c, ...patch };
            // the target can't also be a dropped column
            if (patch.target) next.dropped = next.dropped.filter((n) => n !== patch.target);
            return next;
        });
        if (result) setStale(true);
    }

    function toggleDrop(name) {
        const dropped = config.dropped.includes(name)
            ? config.dropped.filter((n) => n !== name)
            : [...config.dropped, name];
        update({ dropped });
    }

    async function run() {
        setLoading(true);
        setError("");
        try {
            const res = await preprocess(dataset.dataset_id, {
                target: config.target,
                task: config.task,
                drop_columns: config.dropped,
                numeric_impute: config.numericImpute,
                categorical_impute: config.categoricalImpute,
                scaling: config.scaling,
                test_size: config.testSize,
                stratify: config.stratify,
                random_state: config.randomState,
                high_cardinality: config.highCardinality,
                max_categories: config.maxCategories,
                rare_threshold: config.rareThreshold,
                parse_numbers: config.parseNumbers,
                drop_leaky: config.dropLeaky,
            });
            setResult(res);
            setStale(false);
            onPrepared?.(res);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const trainPct = Math.round((1 - config.testSize) * 100);
    const testPct = 100 - trainPct;

    return (
        <section className="mt-24">
            <h3 className="font-display text-2xl font-bold">
                Prepare your <span className="text-gradient">data</span>
            </h3>
            <p className="mt-1 text-sm text-slate-400">
                Raw data can't go straight into a model. Choose how to clean it, and see exactly what changes.
            </p>

            <div className="mt-6 space-y-6">
                <TargetPicker
                    dataset={dataset}
                    task={config.task}
                    onTask={(task) => update({ task })}
                    value={config.target}
                    onChange={(target) => update({ target })}
                />

                <Panel title="2. Features" subtitle="Click a column to leave it out.">
                    <div className="flex flex-wrap gap-2">
                        {columns
                            .filter((c) => c.name !== config.target)
                            .map((c) => {
                                const off = config.dropped.includes(c.name);
                                const hint = [
                                    c.kind === "numeric" ? "numbers" : "labels",
                                    c.unit ? `in ${c.unit}` : null,
                                    c.mixed_units ? "mixed units" : null,
                                    `${c.unique} unique`,
                                    `${c.missing} missing`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ");
                                return (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => toggleDrop(c.name)}
                                        title={hint}
                                        className={`rounded-full border px-3 py-1 text-xs transition ${off
                                                ? "border-white/10 text-slate-600 line-through"
                                                : c.kind === "numeric"
                                                    ? "border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
                                                    : "border-neon-pink/40 text-neon-pink hover:bg-neon-pink/10"
                                            }`}
                                    >
                                        {c.name}
                                        {c.kind === "numeric" && c.raw_kind === "categorical" && (
                                            <span className="ml-1.5 text-[9px] opacity-70">
                                                was text
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                    </div>
                </Panel>

                <div className="grid gap-6 md:grid-cols-2">
                    <Panel title="3. Reading your file" subtitle="We try to read what the values really are.">
                        <div className="space-y-5">
                            <div>
                                <Label
                                    title="Numbers written as text"
                                    hint='Turns "963 hp" and "$1,100,000" into real numbers instead of thousands of categories.'
                                />
                                <Segmented
                                    id="parse-numbers"
                                    value={config.parseNumbers ? "on" : "off"}
                                    onChange={(v) => update({ parseNumbers: v === "on" })}
                                    options={[
                                        { value: "on", label: "Read them" },
                                        { value: "off", label: "Leave as text" },
                                    ]}
                                />
                            </div>

                            <div>
                                <Label
                                    title="Columns with hundreds of one-off values"
                                    hint={cardinalityHelp[config.highCardinality]}
                                />
                                <Segmented
                                    id="high-cardinality"
                                    value={config.highCardinality}
                                    onChange={(v) => update({ highCardinality: v })}
                                    options={[
                                        { value: "group_rare", label: "Group them" },
                                        { value: "drop", label: "Drop" },
                                        { value: "keep", label: "Keep all" },
                                    ]}
                                />
                            </div>

                            <div>
                                <Label
                                    title="Columns that give the answer away"
                                    hint="If a feature predicts the target almost perfectly, the model is reading the answer, not learning."
                                />
                                <Segmented
                                    id="drop-leaky"
                                    value={config.dropLeaky ? "on" : "off"}
                                    onChange={(v) => update({ dropLeaky: v === "on" })}
                                    options={[
                                        { value: "on", label: "Drop them" },
                                        { value: "off", label: "Keep them" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Panel>

                    <Panel title="4. Missing values and scaling" subtitle="How to fill gaps and shape the numbers.">
                        <div className="space-y-5">
                            <div>
                                <Label title="Numbers" hint="Fill gaps with a typical value from the training rows." />
                                <Segmented
                                    id="num-impute"
                                    value={config.numericImpute}
                                    onChange={(v) => update({ numericImpute: v })}
                                    options={[
                                        { value: "median", label: "Median" },
                                        { value: "mean", label: "Mean" },
                                    ]}
                                />
                            </div>
                            <div>
                                <Label title="Text" hint="Fill gaps with a typical value from the training rows." />
                                <Segmented
                                    id="cat-impute"
                                    value={config.categoricalImpute}
                                    onChange={(v) => update({ categoricalImpute: v })}
                                    options={[
                                        { value: "most_frequent", label: "Most common" },
                                        { value: "missing_label", label: "'missing' label" },
                                    ]}
                                />
                            </div>
                            <div>
                                <Label title="Scaling" hint={scalingHelp[config.scaling]} />
                                <Segmented
                                    id="scaling"
                                    value={config.scaling}
                                    onChange={(v) => update({ scaling: v })}
                                    options={[
                                        { value: "standard", label: "Standardize" },
                                        { value: "minmax", label: "Min-Max" },
                                        { value: "none", label: "None" },
                                    ]}
                                />
                            </div>
                        </div>
                    </Panel>
                </div>

                <Panel title="5. Train / test split" subtitle="Train rows teach the model. Test rows are hidden until scoring.">
                    <div className="flex h-9 max-w-md overflow-hidden rounded-lg text-xs font-semibold">
                        <motion.div
                            initial={false}
                            animate={{ width: `${trainPct}%` }}
                            className="grid place-items-center overflow-hidden whitespace-nowrap bg-neon-violet/70"
                        >
                            Train {trainPct}%
                        </motion.div>
                        <motion.div
                            initial={false}
                            animate={{ width: `${testPct}%` }}
                            className="grid place-items-center overflow-hidden whitespace-nowrap bg-neon-pink/70"
                        >
                            Test {testPct}%
                        </motion.div>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max="0.5"
                        step="0.05"
                        value={config.testSize}
                        onChange={(e) => update({ testSize: parseFloat(e.target.value) })}
                        className="mt-3 w-full max-w-md accent-neon-violet"
                        aria-label="Test set size"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-slate-300">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={config.stratify}
                                onChange={(e) => update({ stratify: e.target.checked })}
                                className="h-4 w-4 accent-neon-violet"
                            />
                            Stratify (keep class ratios)
                        </label>
                        <label className="flex items-center gap-2">
                            Seed
                            <input
                                type="number"
                                value={config.randomState}
                                onChange={(e) => update({ randomState: parseInt(e.target.value, 10) || 0 })}
                                className="w-20 rounded-lg border border-white/10 bg-ink px-2 py-1 text-sm outline-none focus:border-neon-violet"
                            />
                        </label>
                    </div>
                </Panel>

                <div className="flex flex-wrap items-center gap-4">
                    <motion.button
                        type="button"
                        onClick={run}
                        disabled={loading || !config.target}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-neon-violet to-neon-cyan px-6 py-3 font-semibold text-white shadow-lg shadow-neon-violet/30 disabled:opacity-60"
                    >
                        {loading && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        )}
                        {loading ? "Preparing..." : result ? "Prepare again" : "Prepare data"}
                    </motion.button>

                    {stale && !loading && (
                        <span className="text-sm text-amber-300">Settings changed. Press the button to apply them.</span>
                    )}
                </div>

                {error && (
                    <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </p>
                )}
            </div>

            {result && <PrepResult result={result} stale={stale} />}
        </section>
    );
}
