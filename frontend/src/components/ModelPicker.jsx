import { motion } from "framer-motion";
import ModelArt from "./ModelArt";

export default function ModelPicker({ models, selected, onSelect, trainedIds }) {
    return (
        <div className="grid gap-5 md:grid-cols-3">
            {models.map((m) => {
                const active = m.id === selected;
                return (
                    <motion.div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(m.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(m.id)}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        className="glass relative cursor-pointer rounded-2xl p-5 outline-none"
                    >
                        {active && (
                            // layoutId lets the glowing ring glide from card to card
                            <motion.span
                                layoutId="model-ring"
                                className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-neon-cyan shadow-[0_0_30px_-6px] shadow-neon-cyan/60"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            />
                        )}

                        <div className="mb-4 h-28 overflow-hidden rounded-xl bg-black/20 p-2">
                            <ModelArt id={m.id} />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="font-display text-lg font-bold">{m.label}</div>
                            {trainedIds.includes(m.id) && (
                                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] text-emerald-300">
                                    trained
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-neon-cyan">{m.tagline}</div>
                        <p className="mt-3 text-sm text-slate-400">{m.how_it_thinks}</p>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <div className="mb-1 text-emerald-300">Good at</div>
                                <ul className="space-y-1 text-slate-400">
                                    {m.strengths.map((s) => (
                                        <li key={s}>{s}</li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <div className="mb-1 text-amber-300">Watch out</div>
                                <ul className="space-y-1 text-slate-400">
                                    {m.weaknesses.map((w) => (
                                        <li key={w}>{w}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                );
            })}
        </div>
    );
}