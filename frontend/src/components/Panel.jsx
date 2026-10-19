import { motion } from "framer-motion";

export default function Panel({ title, subtitle, children, className = "" }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className={`glass rounded-2xl p-6 ${className}`}
        >
            <h4 className="font-display text-lg font-bold">{title}</h4>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
            <div className="mt-5">{children}</div>
        </motion.div>
    );
}