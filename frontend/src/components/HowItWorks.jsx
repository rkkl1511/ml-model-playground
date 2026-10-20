import { motion } from "framer-motion";

const steps = [
    { n: 1, title: "Upload", text: "Bring a CSV, even a messy one, or try a sample." },
    { n: 2, title: "Read", text: "We work out what each column really holds." },
    { n: 3, title: "Train", text: "Pick an algorithm and see it learn, step by step." },
    { n: 4, title: "Compare", text: "Every score is measured against a model that knows nothing." },
];

export default function HowItWorks() {
    return (
        <section id="how" className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="mb-16 text-center font-display text-4xl font-bold">
                How it <span className="text-gradient">works</span>
            </h2>

            <div className="relative grid gap-10 md:grid-cols-4">
                {/* Connecting line that draws itself when scrolled into view */}
                <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="absolute left-[12%] right-[12%] top-6 hidden h-px origin-left bg-linear-to-r from-neon-violet via-neon-cyan to-neon-pink md:block"
                />

                {steps.map((s, i) => (
                    <motion.div
                        key={s.n}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.5, delay: i * 0.15 },
                        }}
                        viewport={{ once: true }}
                        className="relative text-center"
                    >
                        <div className="glass mx-auto grid h-12 w-12 place-items-center rounded-full bg-ink font-display text-lg font-bold">
                            {s.n}
                        </div>
                        <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{s.text}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}