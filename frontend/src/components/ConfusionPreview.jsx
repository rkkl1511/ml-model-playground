import { motion } from "framer-motion";

// Sample numbers for the landing page only. Real matrices come from your model later.
const matrix = [
    [48, 2, 0],
    [3, 44, 3],
    [0, 4, 46],
];
const MAX = 48;

export default function ConfusionPreview() {
    return (
        <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">
                Confusion matrix (sample)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                {matrix.flatMap((row, r) =>
                    row.map((value, c) => (
                        <motion.div
                            key={`${r}-${c}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1.6 + (r * 3 + c) * 0.07, duration: 0.35 }}
                            className="grid h-12 place-items-center rounded-lg text-sm font-semibold"
                            style={{
                                // Diagonal = correct predictions (violet), off-diagonal = mistakes (pink)
                                background:
                                    r === c
                                        ? `rgba(139,92,246,${0.25 + (0.65 * value) / MAX})`
                                        : `rgba(244,114,182,${0.08 + (0.9 * value) / MAX})`,
                            }}
                        >
                            {value}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}