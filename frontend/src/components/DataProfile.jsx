import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getProfile } from "../api";
import Panel from "./Panel";
import HealthRing from "./HealthRing";
import MissingBars from "./MissingBars";
import ClassBalance from "./ClassBalance";
import ColumnExplorer from "./ColumnExplorer";

const levelStyle = {
    warn: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    info: "border-neon-cyan/30 bg-neon-cyan/10 text-cyan-200",
};

export default function DataProfile({ dataset }) {
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        // "cancelled" guards against a slow, old response overwriting a newer one
        let cancelled = false;
        getProfile(dataset.dataset_id)
            .then((p) => !cancelled && setProfile(p))
            .catch((e) => !cancelled && setError(e.message));
        return () => {
            cancelled = true;
        };
    }, [dataset.dataset_id]);

    if (error) {
        return (
            <p className="mt-16 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
                {error}
            </p>
        );
    }

    if (!profile) {
        return (
            <div className="mt-20 grid gap-6 md:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass h-48 animate-pulse rounded-2xl" />
                ))}
            </div>
        );
    }

    const completePct = Math.round((profile.complete_rows / profile.rows) * 100);

    return (
        <section className="mt-20">
            <h3 className="font-display text-2xl font-bold">
                Data <span className="text-gradient">profile</span>
            </h3>
            <p className="mt-1 text-sm text-slate-400">
                What's in your data, and what might trip a model up.
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
                <Panel title="Data health" subtitle="Rows with no missing values." className="h-full">
                    <div className="flex items-center gap-6">
                        <HealthRing value={completePct} label="complete" />
                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="text-slate-400">Missing cells</dt>
                                <dd className="font-display text-xl font-bold">
                                    {profile.missing_cells}{" "}
                                    <span className="text-sm font-normal text-slate-400">({profile.missing_pct}%)</span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-slate-400">Duplicate rows</dt>
                                <dd className="font-display text-xl font-bold">{profile.duplicate_rows}</dd>
                            </div>
                        </dl>
                    </div>
                </Panel>

                <Panel title="Things to know" subtitle="Automatic checks on your data." className="h-full md:col-span-2">
                    {profile.warnings.length === 0 ? (
                        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-4 text-sm text-emerald-200">
                            No red flags found. This dataset looks clean.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {profile.warnings.map((w, i) => (
                                <motion.div
                                    key={w.title}
                                    initial={{ opacity: 0, x: -16 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.08 }}
                                    className={`rounded-xl border px-4 py-3 text-sm ${levelStyle[w.level]}`}
                                >
                                    <div className="font-semibold">{w.title}</div>
                                    <div className="mt-0.5 text-slate-300">{w.text}</div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
                <MissingBars columns={profile.columns} />
                <ClassBalance columns={profile.columns} defaultTarget={dataset.suggested_target} />
            </div>

            <div className="mt-6">
                <ColumnExplorer columns={profile.columns} />
            </div>
        </section>
    );
}