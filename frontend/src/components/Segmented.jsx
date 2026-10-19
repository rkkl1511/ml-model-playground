import { motion } from "framer-motion";

export default function Segmented({ id, options, value, onChange }) {
    return (
        <div className="inline-flex flex-wrap rounded-xl bg-white/[0.05] p-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className="relative rounded-lg px-4 py-1.5 text-sm"
                >
                    {value === o.value && (
                        // layoutId makes this highlight glide between buttons instead of jumping
                        <motion.span
                            layoutId={`seg-${id}`}
                            className="absolute inset-0 rounded-lg bg-linear-to-r from-neon-violet to-neon-cyan"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                    )}
                    <span className={`relative ${value === o.value ? "text-white" : "text-slate-400"}`}>
                        {o.label}
                    </span>
                </button>
            ))}
        </div>
    );
}