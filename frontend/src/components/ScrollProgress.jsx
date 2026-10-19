import { motion, useScroll, useSpring } from "framer-motion";

export default function ScrollProgress() {
    const { scrollYProgress } = useScroll(); // 0 at the top, 1 at the bottom
    const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

    return (
        <motion.div
            style={{ scaleX }}
            className="fixed inset-x-0 top-0 z-[60] h-1 origin-left bg-linear-to-r from-neon-violet via-neon-cyan to-neon-pink"
        />
    );
}