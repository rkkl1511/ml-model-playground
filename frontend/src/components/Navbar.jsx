import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import ApiBadge from "./ApiBadge";

export default function Navbar() {
    return (
        <motion.header
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-x-0 top-0 z-50 px-4 pt-4"
        >
            <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl px-5 py-3">
                <a href="#" className="flex items-center gap-2 font-display text-lg font-bold">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-neon-violet to-neon-cyan">
                        <FlaskConical size={18} />
                    </span>
                    ML Playground
                </a>

                <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
                    <a href="#features" className="transition hover:text-white">Features</a>
                    <a href="#how" className="transition hover:text-white">How it works</a>
                </div>

                <ApiBadge />
            </nav>
        </motion.header>
    );
}