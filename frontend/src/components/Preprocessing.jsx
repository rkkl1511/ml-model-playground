import { useState } from "react";
import { motion } from "framer-motion";
import { preprocess } from "../api";
import Panel from "./Panel";
import Segmented from "./Segmented";
import PrepResult from "./PrepResult";

const scalingHelp = {
    standard: "Shifts each column to mean 0 and spread 1. The usual default.",
    minmax: "Squeezes each column into the range 0 to 1.",
    none: "Leaves numbers as they are. Fine for tree models, risky for KNN and logistic regression.",
};

// IDs (unique on every row) and constant columns are pre-selected to be dropped
function suggestDrops(dataset, target) {
    return dataset.columns
        .filter(
            (c) =>
                c.name !== target &&
                (c.unique <= 1 ||
                    (c.unique === dataset.rows && (c.kind === "categorical" || c.dtype.startsWith("int"))))
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
    // Any column with 2 to 20 distinct values could be a label
    const targets = dataset.columns.filter((c) => c.unique >= 2 && c.unique <= 20);
    const firstTarget =
        targets.find((c) => c.name === dataset.suggested_target)?.name ?? targets[0]?.name ?? "";

    const [config, setConfig] = useState({
        target: firstTarget,
        dropped: suggestDrops(dataset, firstTarget),
        numericImpute: "median",
        categoricalImpute: "most_frequent",
        scaling: "standard",
        testSize: 0.2,
        stratify: true,
        randomState: 42,
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
                drop_columns: config.dropped,
                numeric_impute: config.numericImpute,
                categorical_impute: config.categoricalImpute,
                scaling: config.scaling,
                test_size: config.testSize,
                stratify: config.stratify,
                random_state: config.randomState,
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

            {targets.length === 0 ? (
                <p className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    No column has between 2 and 20 distinct values, so there is no obvious label to predict.
                    This playground handles classification for now.
                </p>
            ) : (
                <Panel title="Preprocessing lab" className="mt-6">
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Left column */}
                        <div className="space-y-7">
                            <div>
                                <Label title="1. Target" hint="What do you want the model to predict?" />
                                <select
                                    value={config.target}
                                    onChange={(e) => update({ target: e.target.value })}
                                    className="w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-slate-200 outline-none focus:border-neon-violet"
                                >
                                    {targets.map((c) => (
                                        <option key={c.name} value={c.name}>
                                            {c.name} ({c.unique} classes)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label
                                    title="2. Features"
                                    hint="Click a column to drop it. IDs and constant columns are pre-selected."
                                />
                                <div className="flex flex-wrap gap-2">
                                    {dataset.columns
                                        .filter((c) => c.name !== config.target)
                                        .map((c) => {
                                            const off = config.dropped.includes(c.name);
                                            return (
                                                <button
                                                    key={c.name}
                                                    type="button"
                                                    onClick={() => toggleDrop(c.name)}
                                                    title={`${c.dtype} · ${c.unique} unique · ${c.missing} missing`}
                                                    className={`rounded-full border px-3 py-1 text-xs transition ${off
                                                            ? "border-white/10 text-slate-600 line-through"
                                                            : c.kind === "numeric"
                                                                ? "border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10"
                                                                : "border-neon-pink/40 text-neon-pink hover:bg-neon-pink/10"
                                                        }`}
                                                >
                                                    {c.name}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            <div>
                                <Label title="3. Missing values" hint="Fill gaps with a typical value from the training rows." />
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-16 text-xs text-slate-400">Numbers</span>
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
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-16 text-xs text-slate-400">Text</span>
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
                                </div>
                            </div>
                        </div>

                        {/* Right column */}
                        <div className="space-y-7">
                            <div>
                                <Label title="4. Scaling" hint={scalingHelp[config.scaling]} />
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

                            <div>
                                <Label
                                    title="5. Train / test split"
                                    hint="Train rows teach the model. Test rows are hidden until scoring."
                                />
                                <div className="flex h-9 overflow-hidden rounded-lg text-xs font-semibold">
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
                                    className="mt-3 w-full accent-neon-violet"
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
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center gap-4">
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
                        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                            {error}
                        </p>
                    )}
                </Panel>
            )}

            {result && <PrepResult result={result} stale={stale} />}
        </section>
    );
}