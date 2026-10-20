import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from "recharts";
import Panel from "./Panel";
import { fmtNum } from "../utils";

function HistTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
        <div
            className="rounded-lg border border-white/10 px-3 py-2 text-xs"
            style={{ background: "rgba(7,7,15,0.92)" }}
        >
            <div className="text-slate-300">{p.range}</div>
            <div className="font-semibold text-white">{p.count} rows</div>
        </div>
    );
}

function NumericView({ col }) {
    const gradientId = useId();
    if (!col.histogram) {
        return <p className="text-sm text-slate-400">No numeric values to chart.</p>;
    }

    const data = col.histogram.map((b) => ({
        label: fmtNum(b.start),
        range: `${fmtNum(b.start)} to ${fmtNum(b.end)}`,
        count: b.count,
    }));
    const s = col.stats;
    const tiles = [
        ["Mean", s.mean],
        ["Std dev", s.std],
        ["Min", s.min],
        ["25%", s.q25],
        ["Median", s.median],
        ["75%", s.q75],
        ["Max", s.max],
    ];

    return (
        <>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22d3ee" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={16}
                        />
                        <YAxis
                            width={36}
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={<HistTooltip />} />
                        <Bar
                            dataKey="count"
                            fill={`url(#${gradientId})`}
                            radius={[4, 4, 0, 0]}
                            animationDuration={900}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white/[0.04] px-4 py-3">
                        <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
                        <div className="font-display text-lg font-bold">{fmtNum(value)}</div>
                    </div>
                ))}
            </div>
        </>
    );
}

function CategoricalView({ col }) {
    const max = Math.max(...col.top_values.map((v) => v.count), 1);
    const hidden = col.unique - col.top_values.length;

    return (
        <div className="space-y-4">
            {col.top_values.map((v, i) => (
                <div key={v.value}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                        <span className="truncate text-slate-300">{v.value}</span>
                        <span className="shrink-0 text-slate-400">{v.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(v.count / max) * 100}%` }}
                            transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
                            className="h-full rounded-full bg-linear-to-r from-neon-violet to-neon-cyan"
                        />
                    </div>
                </div>
            ))}
            {hidden > 0 && <p className="text-xs text-slate-500">+ {hidden} more distinct values not shown</p>}
        </div>
    );
}

export default function ColumnExplorer({ columns }) {
    const [name, setName] = useState(columns[0]?.name);
    const col = columns.find((c) => c.name === name) ?? columns[0];

    // If the data is reloaded, the column we were looking at may be gone.
    useEffect(() => {
        if (!columns.some((c) => c.name === name)) {
            setName(columns[0]?.name);
        }
    }, [columns, name]);

    if (!col) return null;

    return (
        <Panel
            title="Column explorer"
            subtitle={
                col.kind === "numeric"
                    ? "How are the values spread out? A tall bar means many rows fall in that range."
                    : "The most common values in this text column."
            }
        >
            <select
                value={col.name}
                onChange={(e) => setName(e.target.value)}
                className="mb-5 w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-sm text-slate-200 outline-none focus:border-neon-violet sm:w-80"
            >
                {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                        {c.name} ({c.kind})
                        {c.unit ? ` · ${c.unit}` : ""}
                    </option>
                ))}
            </select>

            {/* key= forces a fresh mount so the animation replays for each column */}
            {col.kind === "numeric" ? (
                <NumericView key={col.name} col={col} />
            ) : (
                <CategoricalView key={col.name} col={col} />
            )}
        </Panel>
    );
}