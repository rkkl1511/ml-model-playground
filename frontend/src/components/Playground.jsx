import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Dropzone from "./Dropzone";
import SampleDatasets from "./SampleDatasets";
import DatasetPreview from "./DatasetPreview";
import { uploadCsv, loadSample } from "../api";

export default function Playground() {
    const [dataset, setDataset] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // One helper for both upload and sample: handles loading and errors in one place
    async function run(action) {
        setLoading(true);
        setError("");
        try {
            setDataset(await action());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <section id="playground" className="mx-auto max-w-5xl scroll-mt-24 px-6 py-24">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="mb-10 text-center"
            >
                <h2 className="font-display text-4xl font-bold">
                    Start with your <span className="text-gradient">data</span>
                </h2>
                <p className="mt-3 text-slate-400">Upload a CSV, or pick a sample to explore.</p>
            </motion.div>

            <Dropzone onFile={(file) => run(() => uploadCsv(file))} loading={loading} />

            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200"
                >
                    {error}
                </motion.p>
            )}

            <SampleDatasets onPick={(id) => run(() => loadSample(id))} disabled={loading} />

            <AnimatePresence mode="wait">
                {dataset && <DatasetPreview key={dataset.dataset_id} dataset={dataset} />}
            </AnimatePresence>
        </section>
    );
}