import { useId } from "react";
import { motion } from "framer-motion";
import CountUp from "./CountUp";

export default function HealthRing({ value, label, decimals = 0 }) {
    const r = 52;
    const circumference = 2 * Math.PI * r;
    // Two rings can be on the page at once (the data health and the model
    // score), and a fixed gradient id would be duplicated in the DOM. The
    // browser would then use the first one for both, which is a bug that
    // only shows up sometimes.
    const gradientId = useId();

    return (
        <div className="relative grid h-36 w-36 shrink-0 place-items-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" role="img" aria-label={`${label}: ${value}%`}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                </defs>
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                {/* The ring "draws itself" by animating how much of the dashed stroke is hidden */}
                <motion.circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
                    transition={{ duration: 1.4, ease: "easeOut" }}
                />
            </svg>
            <div className="text-center">
                <div className="font-display text-3xl font-bold">
                    <CountUp to={value} decimals={decimals} suffix="%" />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
            </div>
        </div>
    );
}
