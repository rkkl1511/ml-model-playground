import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database } from "lucide-react";
import { getSamples } from "../api";

export default function SampleDatasets({ onPick, disabled }) {
    const [samples, setSamples] = useState([]);

    useEffect(() => {
        getSamples()
            .then(setSamples)
            .catch(() => setSamples([])); // if the backend is down, just show nothing
    }, []);

    if (samples.length === 0) return null;

    return (
        <div className="mt-8">
            <p className="mb-4 text-center text-sm text-slate-400">
                No data handy? Try a sample dataset:
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
                {samples.map((s) => (
                    <motion.button
                        key={s.id}
                        disabled={disabled}
                        onClick={() => onPick(s.id)}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.97 }}
                        className="glass rounded-2xl p-5 text-left transition-shadow hover:shadow-[0_0_30px_-8px] hover:shadow-neon-violet/60 disabled:opacity-50"
                    >
                        <Database size={20} className="mb-3 text-neon-cyan" />
                        <div className="font-display font-bold">{s.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{s.description}</div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}