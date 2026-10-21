import { useState } from "react";
import { motion } from "framer-motion";
import Panel from "./Panel";
import Segmented from "./Segmented";
import { confusionCell } from "../utils";

const VIOLET = "#8b5cf6";
const CYAN = "#22d3ee";
const PINK = "#f472b6";

/**
 * The confusion matrix, drawn so a person can read it.
 *
 * A grid of numbers is not information on its own. The colour says whether
 * a cell is a right answer or a mistake, hovering a cell says what went
 * wrong in words, and the summary underneath says which class the model
 * struggles with most. The point is not the matrix, it is the mistakes.
 */
export default function ConfusionMatrix({ matrix, classNames }) {
    const [view, setView] = useState("counts");
    const [hovered, setHovered] = useState(null);

    if (!matrix || !matrix.length || !classNames?.length) return null;

    const size = matrix.length;
    const labels = classNames.slice(0, size);

    // The two scales are kept separate on purpose. If the correct answers
    // set the scale, the mistakes all look like zero, which is exactly the
    // thing you came here to look at.
    let maxRight = 0;
    let maxWrong = 0;
    let maxRow = new Array(size).fill(0);
    let total = 0;
    let correct = 0;
    matrix.forEach((row, i) => {
        const rowTotal = row.reduce((a, b) => a + b, 0);
        maxRow[i] = rowTotal;
        row.forEach((value, j) => {
            total += value;
            if (i === j) {
                correct += value;
                maxRight = Math.max(maxRight, value);
            } else {
                maxWrong = Math.max(maxWrong, value);
            }
        });
    });

    // The biggest single mistake, which is the most useful thing on the page.
    let worst = null;
    matrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (i !== j && value > 0 && (!worst || value > worst.value)) {
                worst = { actual: i, predicted: j, value };
            }
        });
    });

    // How well each class did, judged on the rows that really were that class.
    const perClass = labels.map((label, i) => {
        const right = matrix[i][i];
        const rows = maxRow[i];
        return {
            label,
            right,
            rows,
            pct: rows > 0 ? Math.round((right / rows) * 100) : 0,
        };
    }).sort((a, b) => a.pct - b.pct);

    const display = (i, j) => {
        const value = matrix[i][j];
        if (view === "row") {
            return maxRow[i] > 0 ? (value / maxRow[i]) * 100 : 0;
        }
        return value;
    };

    const cellStyle = (i, j) => confusionCell(matrix[i][j], i === j, maxRight, maxWrong);

    const cellText = (i, j) => {
        const value = matrix[i][j];
        if (view === "row") {
            return maxRow[i] > 0 ? `${Math.round((value / maxRow[i]) * 100)}%` : "-";
        }
        return value;
    };

    const explanation = hovered
        ? hovered.i === hovered.j
            ? `${hovered.value} rows really were "${labels[hovered.i]}", and the model got all ${hovered.value} of them right.`
            : `${hovered.value} rows really were "${labels[hovered.i]}", but the model called them "${labels[hovered.j]}".`
        : worst
            ? `The most common mistake: ${worst.value} rows of "${labels[worst.actual]}" were called "${labels[worst.predicted]}".`
            : "No mistakes at all.";

    return (
        <Panel
            title="Where it goes wrong"
            subtitle="Every row is what the answer really was. Every column is what the model said."
            className="mt-4"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(34,211,238,0.72)" }} />
                        right
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-sm" style={{ background: "rgba(244,114,182,0.9)" }} />
                        mistake
                    </span>
                </div>
                <Segmented
                    id="cm-view"
                    value={view}
                    onChange={setView}
                    options={[
                        { value: "counts", label: "How many rows" },
                        { value: "row", label: "Percent of each class" },
                    ]}
                />
            </div>

            <div className="overflow-x-auto pb-2">
                <div
                    className="min-w-fit"
                    style={{
                        display: "grid",
                        gridTemplateColumns: `minmax(80px, 130px) repeat(${size}, minmax(46px, 1fr))`,
                        gap: "3px",
                    }}
                >
                    {/* Corner and column headers */}
                    <div className="flex items-end justify-end pb-1 pr-2 text-[10px] uppercase tracking-widest text-slate-500">
                        predicted
                    </div>
                    {labels.map((label, j) => (
                        <div
                            key={`h-${j}`}
                            title={label}
                            className="truncate pb-1 text-center text-[10px] uppercase tracking-wider text-slate-500"
                        >
                            {label.length > 10 ? `${label.slice(0, 9)}…` : label}
                        </div>
                    ))}

                    {/* Row headers and cells */}
                    {matrix.map((row, i) => (
                        <Row
                            key={`r-${i}`}
                            label={labels[i]}
                            row={row}
                            i={i}
                            size={size}
                            cellStyle={cellStyle}
                            cellText={cellText}
                            onHover={setHovered}
                        />
                    ))}
                </div>
            </div>

            <motion.p
                key={explanation}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-slate-300"
            >
                {explanation}
            </motion.p>

            <div className="mt-4">
                <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                    Per class
                </div>
                <div className="space-y-2">
                    {perClass.map((c) => (
                        <div key={c.label}>
                            <div className="mb-1 flex justify-between gap-3 text-sm">
                                <span className="truncate text-slate-300">{c.label}</span>
                                <span className="shrink-0 text-slate-400">
                                    {c.right} of {c.rows} right
                                    <span className={c.pct === 100 ? "ml-2 text-emerald-300" : c.pct < 70 ? "ml-2 text-amber-300" : "ml-2 text-slate-400"}>
                                        {c.pct}%
                                    </span>
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                        background: c.pct === 100 ? CYAN : c.pct < 70 ? PINK : VIOLET,
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${c.pct}%` }}
                                    transition={{ duration: 0.7, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Panel>
    );
}

/** One row of the matrix: a header plus its cells. */
function Row({ label, row, i, size, cellStyle, cellText, onHover }) {
    return (
        <>
            <div
                title={label}
                className="flex items-center justify-end truncate pr-2 text-right text-xs text-slate-400"
            >
                {label.length > 16 ? `${label.slice(0, 15)}…` : label}
            </div>
            {row.map((value, j) => (
                <motion.button
                    key={j}
                    type="button"
                    onMouseEnter={() => onHover({ i, j, value })}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover({ i, j, value })}
                    onBlur={() => onHover(null)}
                    className="relative grid h-9 place-items-center rounded-md text-xs font-semibold transition-transform hover:z-10 hover:scale-105 focus:z-10 focus:outline-none focus:ring-1 focus:ring-white/40"
                    style={cellStyle(i, j)}
                >
                    {cellText(i, j)}
                </motion.button>
            ))}
        </>
    );
}
