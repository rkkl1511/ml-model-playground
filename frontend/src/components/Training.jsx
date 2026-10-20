import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getModels, trainModel } from "../api";
import ModelPicker from "./ModelPicker";
import TrainingScreen from "./TrainingScreen";
import TrainResult from "./TrainResult";
import Scoreboard from "./Scoreboard";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Training({ dataset, prepared }) {
    const task = prepared?.task || "classification";
    const [models, setModels] = useState([]);
    const [selected, setSelected] = useState("");
    const [results, setResults] = useState({}); // model_id -> result
    const [phase, setPhase] = useState("idle"); // "idle" | "training"
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");

    // Lets us skip updates if the user switched datasets while we were waiting
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    useEffect(() => {
        setError("");
        getModels(task)
            .then((list) => {
                setModels(list);
                setSelected((current) =>
                    list.some((m) => m.id === current) ? current : list[0]?.id ?? ""
                );
            })
            .catch((e) => setError(e.message));
    }, [task]);

    // Preparing the data again means every trained model is out of date
    useEffect(() => {
        setResults({});
    }, [prepared]);

    async function train() {
        setPhase("training");
        setReady(false);
        setError("");
        try {
            // Wait for BOTH the real answer and a minimum animation time
            const [res] = await Promise.all([trainModel(dataset.dataset_id, selected), sleep(2400)]);
            if (!alive.current) return;
            setReady(true);
            await sleep(900); // let the final checkmark play
            if (!alive.current) return;
            setResults((r) => ({ ...r, [res.model_id]: res }));
        } catch (e) {
            if (alive.current) setError(e.message);
        } finally {
            if (alive.current) {
                setPhase("idle");
                setReady(false);
            }
        }
    }

    const heading = (
        <>
            <h3 className="font-display text-2xl font-bold">
                Train a <span className="text-gradient">model</span>
            </h3>
            <p className="mt-1 text-sm text-slate-400">
                {task === "regression"
                    ? "Each algorithm predicts a number in its own way. Pick one, train it, and see how close its guesses are."
                    : "Each algorithm \"thinks\" differently. Pick one, train it, and see how it does on rows it has never seen."}
            </p>
        </>
    );

    if (!prepared) {
        return (
            <section className="mt-24">
                {heading}
                <div className="mt-6 rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-slate-400">
                    Prepare your data above to unlock training.
                </div>
            </section>
        );
    }

    const current = models.find((m) => m.id === selected);
    const trainedIds = Object.keys(results);

    return (
        <section className="mt-24">
            {heading}

            <div className="mt-6">
                <ModelPicker models={models} selected={selected} onSelect={setSelected} trainedIds={trainedIds} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
                <motion.button
                    type="button"
                    onClick={train}
                    disabled={phase === "training" || !current}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="rounded-xl bg-linear-to-r from-neon-violet to-neon-cyan px-6 py-3 font-semibold text-white shadow-lg shadow-neon-violet/30 disabled:opacity-60"
                >
                    {phase === "training" ? "Training..." : `Train ${current?.label ?? "model"}`}
                </motion.button>
            </div>

            {error && (
                <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                </p>
            )}

            <AnimatePresence mode="wait">
                {phase === "training" && (
                    <TrainingScreen key="training" modelLabel={current?.label} ready={ready} />
                )}
            </AnimatePresence>

            {phase === "idle" && results[selected] && <TrainResult key={selected} result={results[selected]} />}

            {trainedIds.length > 0 && <Scoreboard results={Object.values(results)} />}
        </section>
    );
}