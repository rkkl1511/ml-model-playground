import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Code } from "lucide-react";
import CountUp from "./CountUp";
import RotatingWord from "./RotatingWord";
import ConfusionPreview from "./ConfusionPreview";

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12 } },
};
const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const models = [
    { name: "Random Forest", score: 96.4, color: "from-neon-violet to-neon-pink" },
    { name: "KNN", score: 93.1, color: "from-neon-cyan to-neon-violet" },
    { name: "Logistic Regression", score: 91.8, color: "from-neon-pink to-neon-cyan" },
];

function DemoCard() {
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
                        sample preview
                    </span>
                </div>
                <div className="text-gradient font-display text-6xl font-bold">
                    <CountUp to={96.4} decimals={1} suffix="%" />
                </div>

                <div className="mt-6 space-y-4">
                    {models.map((m, i) => (
                        <div key={m.name}>
                            <div className="mb-1 flex justify-between text-sm text-slate-300">
                                <span>{m.name}</span>
                                <span>{m.score}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <motion.div
                                    className={`h-full rounded-full bg-linear-to-r ${m.color}`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${m.score}%` }}
                                    transition={{ duration: 1.2, delay: 0.9 + i * 0.2, ease: "easeOut" }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6">
                    <ConfusionPreview />
                </div>
            </motion.div>
        </motion.div>
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
                    Upload a dataset, pick an algorithm, and see accuracy, confusion
                    matrices and feature importance come alive, all in your browser.
                </motion.p>

                <motion.div variants={item} className="mt-8 flex flex-wrap gap-4">
                    <motion.a
                        href="#features"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-neon-violet to-neon-cyan px-6 py-3 font-semibold text-white shadow-lg shadow-neon-violet/30"
                    >
                        Start playing <ArrowRight size={18} />
                    </motion.a>

                    <motion.a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="glass inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-slate-200"
                    >
                        <Code size={18} /> View on GitHub
                    </motion.a>
                </motion.div>
            </motion.div>

            <DemoCard />
        </section>
    );
}