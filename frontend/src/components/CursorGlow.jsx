import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CursorGlow() {
    const x = useMotionValue(-500);
    const y = useMotionValue(-500);
    // useSpring makes the glow trail behind the cursor smoothly
    const sx = useSpring(x, { stiffness: 120, damping: 20 });
    const sy = useSpring(y, { stiffness: 120, damping: 20 });

    useEffect(() => {
        const move = (e) => {
            x.set(e.clientX - 200); // 200 = half the glow size, so it centers on the cursor
            y.set(e.clientY - 200);
        };
        window.addEventListener("mousemove", move);
        return () => window.removeEventListener("mousemove", move);
    }, [x, y]);

    return (
        <motion.div
            style={{ x: sx, y: sy }}
            className="pointer-events-none fixed left-0 top-0 -z-10 h-[400px] w-[400px] rounded-full bg-neon-violet/20 blur-3xl"
        />
    );
}