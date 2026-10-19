import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export default function CountUp({ to, decimals = 0, duration = 1.8, suffix = "" }) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        const controls = animate(0, to, {
            duration,
            ease: "easeOut",
            onUpdate: (v) => setValue(v),
        });
        return () => controls.stop();
    }, [to, duration]);

    return (
        <span>
            {value.toFixed(decimals)}
            {suffix}
        </span>
    );
}