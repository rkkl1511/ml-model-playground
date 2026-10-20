import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export default function CountUp({ to, decimals = 0, duration = 1.8, suffix = "" }) {
    const [value, setValue] = useState(0);
    // Not every number on screen is a number. A label like "Price" must not
    // reach the animation, or the whole page goes down with it.
    const isNumber = typeof to === "number" && Number.isFinite(to);

    useEffect(() => {
        if (!isNumber) {
            setValue(0);
            return;
        }
        const controls = animate(0, to, {
            duration,
            ease: "easeOut",
            onUpdate: (v) => setValue(v),
        });
        return () => controls.stop();
    }, [to, duration, isNumber]);

    if (!isNumber) {
        return <span>{to}{suffix}</span>;
    }

    return (
        <span>
            {value.toFixed(decimals)}
            {suffix}
        </span>
    );
}
