import { useEffect, useRef } from "react";

const COLORS = ["139,92,246", "34,211,238", "244,114,182"]; // violet, cyan, pink (rgb)
const LINK_DIST = 130;
const MOUSE_DIST = 170;

export default function NeuralBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const mouse = { x: -9999, y: -9999 };
        let width = 0;
        let height = 0;
        let nodes = [];
        let frameId;

        function resize() {
            const dpr = window.devicePixelRatio || 1;
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // More screen = more nodes, capped so it stays smooth
            const count = Math.min(90, Math.floor((width * height) / 18000));
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 1.6 + 0.8,
                c: COLORS[Math.floor(Math.random() * COLORS.length)],
            }));
        }

        function onMove(e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        }

        function frame() {
            ctx.clearRect(0, 0, width, height);

            // 1. move nodes, bounce off edges
            for (const n of nodes) {
                n.x += n.vx;
                n.y += n.vy;
                if (n.x < 0 || n.x > width) n.vx *= -1;
                if (n.y < 0 || n.y > height) n.vy *= -1;
            }

            // 2. draw links between close nodes, and to the mouse
            ctx.lineWidth = 1;
            for (let i = 0; i < nodes.length; i++) {
                const a = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const b = nodes[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d < LINK_DIST) {
                        ctx.strokeStyle = `rgba(${a.c},${(1 - d / LINK_DIST) * 0.35})`;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
                const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
                if (dm < MOUSE_DIST) {
                    ctx.strokeStyle = `rgba(${a.c},${(1 - dm / MOUSE_DIST) * 0.8})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            // 3. draw the dots on top
            for (const n of nodes) {
                ctx.fillStyle = `rgba(${n.c},0.9)`;
                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fill();
            }

            frameId = requestAnimationFrame(frame);
        }

        resize();
        frame();
        window.addEventListener("resize", resize);
        window.addEventListener("mousemove", onMove);

        // Cleanup: stop the loop and remove listeners when the component unmounts
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", onMove);
        };
    }, []);

    return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" />;
}