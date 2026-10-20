import { motion } from "framer-motion";
import Panel from "./Panel";

/**
 * The running leaderboard. Classification models are ranked by accuracy and
 * regression models by R-squared, so the bar always means "higher is better".
 */
export default function Scoreboard({ results }) {
    if (!results || results.length === 0) return null;

    const isRegression = results[0].task === "regression";
    const scoreOf = (r) => (isRegression ? r.test_r2 : r.test_accuracy);
    const sorted = [...results].sort((a, b) => scoreOf(b) - scoreOf(a));

    // A negative R-squared is worse than the average, so the bar floor is 0.
    const best = Math.max(...sorted.map(scoreOf), isRegression ? 0 : 100);

    return (
        <Panel
            title="Scoreboard"
            subtitle={
                isRegression
                    ? "R-squared of every model you've trained. Step 8 will compare them properly."
                    : "Test accuracy of every model you've trained. Step 8 will compare them properly."
            }
            className="mt-6"
        >
            <div className="space-y-4">
                {sorted.map((r, i) => {
                    const score = scoreOf(r);
                    const width = best > 0 ? Math.max(0, (score / best) * 100) : 0;
                    return (
                        // "layout" makes rows glide to their new position when the ranking changes
                        <motion.div layout key={r.model_id} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 text-slate-300">
                                    {r.label}
                                    {i === 0 && sorted.length > 1 && (
                                        <span className="rounded-full bg-neon-cyan/15 px-2 py-0.5 text-[10px] text-neon-cyan">
                                            best so far
                                        </span>
                                    )}
                                </span>
                                <span className="text-slate-400">
                                    {isRegression
                                        ? `r² ${score.toFixed(3)}`
                                        : `${score}%`}
                                </span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    className="h-full rounded-full bg-linear-to-r from-neon-violet to-neon-cyan"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${width}%` }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </Panel>
    );
}
