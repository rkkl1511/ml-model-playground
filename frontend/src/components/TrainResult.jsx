import { motion } from "framer-motion";
import HealthRing from "./HealthRing";
import Panel from "./Panel";
import FoldChart from "./FoldChart";

const toneStyle = {
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    mid: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    bad: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};

function Bar({ label, value, max, color, delay, suffix = "%" }) {
    const width = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
    return (
        <div>
            <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="text-slate-300">{label}</span>
                <span className="shrink-0 text-slate-400">
                    {typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
                    {suffix}
                </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 1, delay, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

/** The result of training a classifier: how often it was right. */
function ClassificationResult({ result }) {
    const mistakes = result.test_rows - result.correct;
    const v = result.verdict;

    const facts = [
        { label: "Training time", value: `${result.fit_ms} ms` },
        { label: "Test rows", value: result.test_rows },
        {
            label: "One mistake moves the score by",
            value: `${result.points_per_row} points`,
            warn: result.test_rows < 50,
        },
    ];

    return (
        <>
            <div className="grid gap-6 md:grid-cols-3">
                <Panel
                    title={result.cv ? "Accuracy" : "Accuracy"}
                    subtitle={
                        result.cv
                            ? "Averaged over several splits of the data."
                            : "On the held-out test rows."
                    }
                    className="h-full"
                >
                    <div className="flex justify-center">
                        <HealthRing
                            value={headline}
                            decimals={1}
                            label={result.cv ? "cross-validated" : "accuracy"}
                        />
                    </div>
                    <p className="mt-4 text-center text-sm text-slate-400">
                        {result.correct} of {result.test_rows} correct
                        {mistakes > 0 ? ` · ${mistakes} wrong` : " · none wrong"}
                    </p>
                    {result.cv && (
                        <p className="mt-1 text-center text-xs text-slate-500">
                            on the single held-out split: {result.test_accuracy}%
                        </p>
                    )}
                </Panel>

                <Panel
                    title="Is that good?"
                    subtitle="A score only means something next to a baseline."
                    className="h-full md:col-span-2"
                >
                    <div className="space-y-4">
                        <Bar
                            label="Always guess the most common class"
                            value={baseline}
                            color="#64748b"
                            delay={0.1}
                        />
                        <Bar
                            label="Training rows (it studied these)"
                            value={result.train_accuracy}
                            color="#8b5cf6"
                            delay={0.25}
                        />
                        {result.cv && (
                            <Bar
                                label={`Cross-validated (${result.cv.n_splits} folds, the one to trust)`}
                                value={result.cv.mean}
                                color="#22d3ee"
                                delay={0.4}
                            />
                        )}
                        <Bar
                            label="One held-out split (noisier)"
                            value={result.test_accuracy}
                            color="#f472b6"
                            delay={0.55}
                        />
                    </div>
                    <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${toneStyle[v.tone]}`}>
                        <span className="font-semibold">{v.title}.</span> {v.text}
                    </p>
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {facts.map((f) => (
                    <div key={f.label} className="rounded-xl bg-white/[0.04] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400">{f.label}</div>
                        <div className="font-display text-lg font-bold">{f.value}</div>
                        {f.warn && (
                            <div className="mt-0.5 text-xs text-amber-300">
                                Few test rows, so treat this score as a rough estimate.
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

/** The result of training a regressor: how close its guesses were. */
function RegressionResult({ result, headline }) {
    const v = result.verdict;
    // R-squared can be negative, so we show it on a scale that makes room.
    const r2Percent = Math.max(0, Math.round(headline * 100));
    const improvement = result.baseline_mae > 0
        ? Math.round((1 - result.mae / result.baseline_mae) * 100)
        : 0;

    const facts = [
        { label: "Training time", value: `${result.fit_ms} ms` },
        { label: "Test rows", value: result.test_rows },
        { label: "Average target", value: result.target_mean?.toLocaleString() },
    ];

    return (
        <>
            <div className="grid gap-6 md:grid-cols-3">
                <Panel
                    title="How much it explains"
                    subtitle="R-squared: the share of the variation it accounts for."
                    className="h-full"
                >
                    <div className="flex justify-center">
                        <HealthRing
                            value={r2Percent}
                            decimals={0}
                            label={headline >= 0 ? "r squared" : "worse than average"}
                        />
                    </div>
                    <p className="mt-4 text-center text-sm text-slate-400">
                        R² of {headline.toFixed(3)}
                        {headline >= 0
                            ? ` · explains ${r2Percent}% of the variation`
                            : " · worse than guessing the average"}
                        {result.cv && (
                            <span className="block text-xs text-slate-500">
                                single split: {result.test_r2.toFixed(3)}
                            </span>
                        )}
                    </p>
                </Panel>

                <Panel
                    title="How far off is it?"
                    subtitle="Compared with always guessing the average."
                    className="h-full md:col-span-2"
                >
                    <div className="space-y-4">
                        <Bar
                            label="Average error if you always guessed the average"
                            value={result.baseline_mae}
                            max={Math.max(result.baseline_mae, result.rmse, 1)}
                            color="#64748b"
                            delay={0.1}
                            suffix=""
                        />
                        <Bar
                            label="Average error of this model"
                            value={result.mae}
                            max={Math.max(result.baseline_mae, result.rmse, 1)}
                            color="#22d3ee"
                            delay={0.25}
                            suffix=""
                        />
                    </div>
                    <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${toneStyle[v.tone]}`}>
                        <span className="font-semibold">{v.title}.</span> {v.text}
                    </p>
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {facts.map((f) => (
                    <div key={f.label} className="rounded-xl bg-white/[0.04] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400">{f.label}</div>
                        <div className="font-display text-lg font-bold">{f.value}</div>
                    </div>
                ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                        Mean absolute error
                    </div>
                    <div className="font-display text-lg font-bold">
                        {result.mae.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">off by this much on a typical row</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                        Root mean squared error
                    </div>
                    <div className="font-display text-lg font-bold">
                        {result.rmse.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500">punishes big misses more</div>
                </div>
                <div className="rounded-xl bg-white/[0.04] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                        Better than the average
                    </div>
                    <div className="font-display text-lg font-bold text-neon-cyan">
                        {improvement}%
                    </div>
                    <div className="text-xs text-slate-500">smaller error than guessing</div>
                </div>
            </div>
        </>
    );
}

export default function TrainResult({ result }) {
    const isRegression = result.task === "regression";
    // The score to show: the cross-validated one when we have it, because a
    // single split of a few dozen rows swings by several points.
    const headline = result.cv
        ? result.cv.mean
        : isRegression
            ? result.test_r2
            : result.test_accuracy;
    const headlineSuffix = result.cv ? "%" : "";
    const baseline = result.cv
        ? result.cv_baseline?.mean
        : isRegression
            ? result.baseline_r2
            : result.baseline_accuracy;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-10"
        >
            <div className="mb-5 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
                    ✓
                </span>
                <div>
                    <div className="font-display text-xl font-bold">{result.label} is trained</div>
                    <div className="text-sm text-slate-400">
                        {result.cv
                            ? `Cross-validated over ${result.cv.n_splits} folds, and scored on ${result.test_rows} held-back rows.`
                            : `Scored on ${result.test_rows} rows it has never seen.`}
                    </div>
                </div>
            </div>

            {isRegression
                ? <RegressionResult result={result} headline={headline} baseline={baseline} />
                : <ClassificationResult result={result} headline={headline} baseline={baseline} />}

            <FoldChart
                cv={result.cv}
                cvBaseline={result.cv_baseline}
                holdout={isRegression ? result.test_r2 : result.test_accuracy}
                holdoutLabel="The single test split"
            />
        </motion.div>
    );
}
