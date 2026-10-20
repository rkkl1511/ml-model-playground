import { motion } from "framer-motion";
import Panel from "./Panel";

/**
 * Shows how much the score moves when you train on different rows.
 *
 * A single test split is one draw from a hat. With 30 rows in the test
 * set, moving one row changes the score by three points. Cross-validation
 * trains several times over and shows the spread, so the number comes with
 * an honest "plus or minus" attached to it.
 */
export default function FoldChart({ cv, cvBaseline, holdout, holdoutLabel }) {
    if (!cv || !cv.folds?.length) return null;

    const isAccuracy = cv.metric === "accuracy";
    const values = [...cv.folds];
    if (cvBaseline) values.push(cvBaseline.mean);
    const lo = Math.min(0, ...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const pct = (v) => ((v - lo) / span) * 100;

    const mean = cv.mean;
    const std = cv.std;
    // A range you can honestly quote: the mean, plus or minus two spreads.
    const low = mean - 2 * std;
    const high = mean + 2 * std;

    const format = (v) => (isAccuracy ? `${v.toFixed(1)}%` : v.toFixed(3));

    // Is the single split consistent with the cross-validated score?
    let note = null;
    if (holdout !== null && holdout !== undefined) {
        const gap = holdout - mean;
        if (Math.abs(gap) <= std) {
            note = `The single test split said ${format(holdout)}, which sits inside the spread. ` +
                `The two agree, so the score is real.`;
        } else if (gap > 0) {
            note = `The single test split said ${format(holdout)}, which is above the spread. ` +
                `That split was a lucky one. Trust the cross-validated number instead.`;
        } else {
            note = `The single test split said ${format(holdout)}, which is below the spread. ` +
                `That split was an unlucky one. The cross-validated number is the fairer estimate.`;
        }
    }

    return (
        <Panel
            title="How stable is that score?"
            subtitle={`The same model, trained ${cv.n_splits} times over on different rows.`}
            className="mt-4"
        >
            <div className="space-y-3">
                {cv.folds.map((value, i) => (
                    <div key={i}>
                        <div className="mb-1 flex justify-between gap-3 text-sm">
                            <span className="text-slate-400">
                                {holdoutLabel ? holdoutLabel : `Fold ${i + 1}`}
                            </span>
                            <span className="text-slate-300">{format(value)}</span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                                className="h-full rounded-full bg-linear-to-r from-neon-violet to-neon-cyan"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct(value)}%` }}
                                transition={{ duration: 0.7, delay: i * 0.06, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {cvBaseline && (
                <div className="mt-4 border-t border-white/10 pt-3 text-xs text-slate-400">
                    The baseline, cross-validated the same way, scores {format(cvBaseline.mean)}.
                    A model has to beat that, not zero.
                </div>
            )}

            <div className="mt-4 rounded-xl bg-white/[0.04] px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-slate-400">
                    Cross-validated score
                </div>
                <div className="mt-1 font-display text-2xl font-bold">
                    {format(mean)}
                    <span className="ml-2 text-base font-normal text-slate-400">
                        ± {std.toFixed(1)} points
                    </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                    So the honest answer is <strong className="text-slate-200">
                        about {format(Math.max(low, 0))} to {format(high)}
                    </strong>, not one exact number. Anything inside that range is
                    the same result, measured slightly differently.
                </p>
            </div>

            {note && <p className="mt-3 text-sm text-slate-400">{note}</p>}
        </Panel>
    );
}
