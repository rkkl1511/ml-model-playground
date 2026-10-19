import { motion } from "framer-motion";
import { Upload, Cpu, Target, Trophy, Sparkles, SlidersHorizontal } from "lucide-react";

const features = [
    { icon: Upload, title: "Drop in any CSV", text: "Drag and drop your data and get an instant profile of every column." },
    { icon: Cpu, title: "Pick your algorithm", text: "Logistic Regression, KNN, Random Forest and more, one click each." },
    { icon: Target, title: "Confusion matrices", text: "See exactly where your model gets confused, cell by cell." },
    { icon: Trophy, title: "Model showdown", text: "Race every algorithm head to head on the same data." },
    { icon: Sparkles, title: "Feature importance", text: "Find out which columns actually drive the predictions." },
    { icon: SlidersHorizontal, title: "Tune and predict", text: "Drag sliders, retrain live, and test predictions on new inputs." },
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
                        whileHover={{ y: -6 }}
                        className="glass rounded-2xl p-6 transition-all duration-300 hover:border-neon-violet/50 hover:shadow-[0_0_40px_-10px] hover:shadow-neon-violet/50"
                    >
                        <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-linear-to-br from-neon-violet to-neon-cyan">
                            <f.icon size={22} />
                        </div>
                        <h3 className="font-display text-lg font-bold">{f.title}</h3>
                        <p className="mt-2 text-sm text-slate-400">{f.text}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}