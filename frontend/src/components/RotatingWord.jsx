import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const words = ["think", "learn", "predict", "improve"];

export default function RotatingWord() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), 2200);
        return () => clearInterval(timer);
    }, []);

    return (
        <span className="inline-block">
            {/* mode="wait" lets the old word exit before the new one enters */}
            <AnimatePresence mode="wait">
                <motion.span
                    key={words[index]}
                    className="text-gradient inline-block"
                    initial={{ y: 30, opacity: 0, filter: "blur(8px)" }}
                    animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                    exit={{ y: -30, opacity: 0, filter: "blur(8px)" }}
                    transition={{ duration: 0.4 }}
                >
                    {words[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}