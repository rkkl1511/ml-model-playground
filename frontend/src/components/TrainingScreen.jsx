import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const STAGES = [
    { title: "Loading training rows", note: "The model gets its study material." },
    { title: "Learning patterns", note: "It looks for what separates the classes." },
    { title: "Testing on held-out rows", note: "Rows it has never seen before." },
    { title: "Scoring the answers", note: "Comparing predictions with the truth." },
];

export default function TrainingScreen({ modelLabel, ready }) {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const timers = [setTimeout(() => setTick(1), 600), setTimeout(() => setTick(2), 1300)];
        return () => timers.forEach(clearTimeout);
    }, []);

    // The last stage only lights up once the server has really answered
    const stage = ready ? 3 : tick;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass mt-10 rounded-3xl p-8 text-center"
        >
            <div className="relative mx-auto grid h-40 w-40 place-items-center">
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-dashed border-neon-violet/60"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="absolute inset-4 rounded-full border-2 border-dashed border-neon-cyan/60"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="h-16 w-16 rounded-full bg-linear-to-br from-neon-violet to-neon-cyan blur-[2px]"
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                />
            </div>

            <h4 className="mt-6 font-display text-xl font-bold">Training {modelLabel}</h4>

            <div className="mx-auto mt-6 h-2 max-w-md overflow-hidden rounded-full bg-white/10">
                <motion.div
                    className="h-full rounded-full bg-linear-to-r from-neon-violet to-neon-cyan"
                    animate={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
            </div>

            <ul className="mx-auto mt-6 max-w-md space-y-3 text-left">
                {STAGES.map((s, i) => {
                    const done = i < stage || (ready && i === 3);
                    const current = i === stage && !done;
                    return (
                        <li
                            key={s.title}
                            className={`flex items-start gap-3 transition-opacity ${i > stage ? "opacity-30" : "opacity-100"}`}
                        >
                            <span
                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done ? "bg-emerald-400/30 text-emerald-300" : "bg-white/10 text-slate-400"
                                    }`}
                            >
                                {done ? "✓" : current ? <span className="h-2 w-2 animate-pulse rounded-full bg-neon-cyan" /> : ""}
                            </span>
                            <div>
                                <div className="text-sm font-semibold">{s.title}</div>
                                <div className="text-xs text-slate-500">{s.note}</div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <p className="mt-6 text-xs text-slate-600">
                Real training takes a few milliseconds on small data, so these stages are slowed down so you can follow along.
            </p>
        </motion.div>
    );
}