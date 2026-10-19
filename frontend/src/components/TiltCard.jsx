import { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export default function TiltCard({ children, className = "" }) {
    const ref = useRef(null);

    // Mouse position inside the card, from 0 to 1 (0.5 = center)
    const px = useMotionValue(0.5);
    const py = useMotionValue(0.5);

    const spring = { stiffness: 200, damping: 20 };
    const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), spring);
    const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), spring);

    // A soft white highlight that follows the cursor
    const glare = useTransform(
        [px, py],
        ([x, y]) =>
            `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.14), transparent 55%)`
    );

    function onMove(e) {
        const rect = ref.current.getBoundingClientRect();
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
    }

    function onLeave() {
        px.set(0.5);
        py.set(0.5);
    }

    return (
        <div className="h-full" style={{ perspective: 800 }}>
            <motion.div
                ref={ref}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className={`relative h-full ${className}`}
            >
                {children}
                <motion.div
                    className="pointer-events-none absolute inset-0 rounded-[inherit]"
                    style={{ background: glare }}
                />
            </motion.div>
        </div>
    );
}