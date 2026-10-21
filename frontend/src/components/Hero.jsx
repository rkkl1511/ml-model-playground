import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Code } from "lucide-react";
import CountUp from "./CountUp";
import RotatingWord from "./RotatingWord";
import { getShowcase } from "../api";
import { confusionCell } from "../utils";

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
};
const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const COLOURS = [
    "from-neon-violet to-neon-pink",
    "from-neon-cyan to-neon-violet",
    "from-neon-pink to-neon-cyan",
];

/**
 * The card on the landing page shows numbers from a real model, worked out
 * by the backend on the iris dataset. No made-up figures.
 */
function DemoCard() {
    const [data, setData] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getShowcase()
            .then((d) => !cancelled && setData(d))
            .catch(() => {
                /* the card just stays empty; the page still works */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        >
            <motion.div
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className="glass rounded-3xl p-6 shadow-2xl shadow-neon-violet/20"
            >
                <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-widest text-slate-400">
                    <span>Best accuracy</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 normal-case tracking-normal">
                        {data ? "iris, a real run" : "loading"}
                    </span>
                </div>
                <div className="text-gradient font-display text-6xl font-bold">
                    {data ? <CountUp to={data.best_score} decimals={1} suffix="%" /> : "--"}
                </div>

                <div className="mt-6 space-y-4">
                    {(data?.models || []).map((m, i) => (
                        <div key={m.id}>
                            <div className="mb-1 flex justify-between text-sm text-slate-300">
                                <span>{m.label}</span>
                                <span>{m.score.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    className={`h-full rounded-full bg-linear-to-r ${COLOURS[i % COLOURS.length]}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${m.score}%` }}
                                    transition={{ duration: 1.2, delay: 0.9 + i * 0.2, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {data && (
                    <div className="mt-6">
                        <MiniMatrix matrix={data.confusion_matrix} names={data.class_names} />
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}

/** A small, real confusion matrix. Cyan on the diagonal, pink off it. */
function MiniMatrix({ matrix, names }) {
    let maxRight = 0;
    let maxWrong = 0;
    matrix.forEach((row, r) =>
        row.forEach((value, c) => {
            if (r === c) maxRight = Math.max(maxRight, value);
            else maxWrong = Math.max(maxWrong, value);
        })
    );
    return (
        <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                Confusion matrix
            </div>
            <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${matrix.length}, minmax(0, 1fr))` }}
            >
                {matrix.flatMap((row, r) =>
                    row.map((value, c) => (
                        <motion.div
                            key={`${r}-${c}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1.6 + (r * matrix.length + c) * 0.07, duration: 0.35 }}
                            className="grid h-12 place-items-center rounded-lg text-sm font-semibold"
                            style={confusionCell(value, r === c, maxRight, maxWrong)}
                            title={`${names[r]} predicted as ${names[c]}: ${value}`}
                        >
                            {value}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}

export default function Hero() {
    return (
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-28 pt-40 md:grid-cols-2">
            <motion.div variants={container} initial="hidden" animate="show">
                <motion.span
                    variants={item}
                    className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-slate-300"
                >
                    <Sparkles size={14} className="text-neon-cyan" />
                    Interactive machine-learning lab
                </motion.span>

                <motion.h1
                    variants={item}
                    className="mt-6 font-display text-5xl font-bold leading-tight md:text-6xl"
                >
                    Train models.
                    <br />
                    Watch them <RotatingWord />
                </motion.h1>

                <motion.p variants={item} className="mt-6 max-w-md text-lg text-slate-400">
                    Upload a messy real-world CSV, and watch it get read properly:
                    numbers pulled out of units, prices cleaned up, and a model
                    scored honestly against a baseline.
                </motion.p>

                <motion.div variants={item} className="mt-8 flex flex-wrap gap-4">
                    <motion.a
                        href="#playground"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-neon-violet to-neon-cyan px-6 py-3 font-semibold text-white shadow-lg shadow-neon-violet/30"
                    >
                        Start playing <ArrowRight size={18} />
                    </motion.a>

                    <motion.a
                        href="#how"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="glass inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-slate-200"
                    >
                        <Code size={18} /> How it works
                    </motion.a>
                </motion.div>
            </motion.div>

            <DemoCard />
        </section>
    );
}
