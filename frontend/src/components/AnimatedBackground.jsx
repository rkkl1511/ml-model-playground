import { motion } from "framer-motion";

const blobs = [
    { color: "bg-neon-violet", size: "h-96 w-96", pos: "top-[-8rem] left-[-6rem]", x: [0, 80, 0], y: [0, 50, 0], d: 18 },
    { color: "bg-neon-cyan", size: "h-80 w-80", pos: "top-1/3 right-[-6rem]", x: [0, -70, 0], y: [0, 60, 0], d: 22 },
    { color: "bg-neon-pink", size: "h-72 w-72", pos: "bottom-[-6rem] left-1/3", x: [0, 60, 0], y: [0, -50, 0], d: 20 },
];

export default function AnimatedBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {blobs.map((b, i) => (
                <motion.div
                    key={i}
                    className={`absolute rounded-full opacity-25 blur-3xl ${b.color} ${b.size} ${b.pos}`}
                    animate={{ x: b.x, y: b.y }}
                    transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
                />
            ))}
            <div className="grid-bg absolute inset-0" />
        </div>
    );
}