import { motion } from "framer-motion";
import { Upload, Cpu, Target, Trophy, Sparkles, SlidersHorizontal } from "lucide-react";
import TiltCard from "./TiltCard";

// Every card here describes something the app really does. No promises
// the code cannot keep.
const features = [
    {
        icon: Upload,
        title: "Drop in any CSV",
        text: "Drag and drop your data and get an instant profile of every column.",
    },
    {
        icon: Sparkles,
        title: "Reads past the formatting",
        text: 'Pulls real numbers out of "963 hp" and "$1,100,000", and treats TOYOTA and Toyota as one thing.',
    },
    {
        icon: Target,
        title: "Catches the cheats",
        text: "Spots columns that give the target away, so your score is not a lie.",
    },
    {
        icon: Cpu,
        title: "Nine algorithms",
        text: "Classifiers for labels, regressors for numbers. You pick the target, we pick the rest.",
    },
    {
        icon: Trophy,
        title: "Scored against a baseline",
        text: "Every model is compared with a model that knows nothing. Only real wins count.",
    },
    {
        icon: SlidersHorizontal,
        title: "You stay in control",
        text: "Every cleaning decision is explained, and every one of them is yours to change.",
    },
];

export default function Features() {
    return (
        <section id="features" className="mx-auto max-w-6xl px-6 py-24">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mb-14 text-center"
            >
                <h2 className="font-display text-4xl font-bold">
                    Everything you need to <span className="text-gradient">understand ML</span>
                </h2>
                <p className="mt-3 text-slate-400">From raw data to a trained model in minutes.</p>
            </motion.div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((f, i) => (
                    <motion.div
                        key={f.title}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.5, delay: i * 0.08 },
                        }}
                        viewport={{ once: true, margin: "-60px" }}
                    >
                        <TiltCard className="glass rounded-2xl p-6 transition-shadow duration-300 hover:border-neon-violet/50 hover:shadow-[0_0_40px_-10px] hover:shadow-neon-violet/50">
                            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-neon-violet to-neon-cyan">
                                <f.icon size={22} />
                            </div>
                            <h3 className="font-display text-lg font-bold">{f.title}</h3>
                            <p className="mt-2 text-sm text-slate-400">{f.text}</p>
                        </TiltCard>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}