import { motion } from "framer-motion";

const VIOLET = "#8b5cf6";
const PINK = "#f472b6";
const CYAN = "#22d3ee";

const A = [[28, 30], [44, 62], [34, 92], [62, 44], [56, 82], [78, 24]];
const B = [[128, 34], [150, 62], [140, 96], [168, 44], [120, 78], [172, 88]];

function Dots({ points, color, delay = 0, opacity = 1 }) {
    return (
        <>
            {points.map(([x, y], i) => (
                <motion.circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="5"
                    fill={color}
                    initial={{ opacity: 0 }}
                    animate={{ opacity }}
                    transition={{ delay: delay + i * 0.06 }}
                />
            ))}
        </>
    );
}

// Logistic regression: one straight line separates the two groups
function LogisticArt() {
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            <Dots points={A} color={VIOLET} />
            <Dots points={B} color={PINK} delay={0.3} />
            <motion.line
                x1="104" y1="6" x2="96" y2="114"
                stroke={CYAN} strokeWidth="2.5" strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.8, duration: 0.9 }}
            />
        </svg>
    );
}

// KNN: a new point looks at its 5 nearest neighbours and takes a vote
const FAR_V = [[30, 30], [40, 95], [55, 20]];
const FAR_P = [[165, 40], [150, 100], [170, 75]];
const NEAR = [
    [78, 48, VIOLET], [84, 86, VIOLET], [70, 66, VIOLET],
    [124, 52, PINK], [120, 80, PINK],
];

function KnnArt() {
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            <Dots points={FAR_V} color={VIOLET} opacity={0.4} />
            <Dots points={FAR_P} color={PINK} opacity={0.4} />
            <motion.circle
                cx="100" cy="60" r="36" fill="none"
                stroke={CYAN} strokeWidth="1.5" strokeDasharray="4 4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            />
            {NEAR.map(([x, y, color], i) => (
                <g key={i}>
                    <motion.line
                        x1="100" y1="60" x2={x} y2={y}
                        stroke={color} strokeWidth="1.5"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ delay: 0.9 + i * 0.15 }}
                    />
                    <circle cx={x} cy={y} r="5" fill={color} />
                </g>
            ))}
            <circle cx="100" cy="60" r="8" fill="#07070f" stroke="#fff" strokeWidth="2" />
            <text x="100" y="64" textAnchor="middle" fontSize="10" fill="#fff">?</text>
        </svg>
    );
}

// Random forest: several small trees each cast a vote, the majority wins
const TREES = [
    { x: 36, leaves: [VIOLET, VIOLET], vote: VIOLET },
    { x: 100, leaves: [VIOLET, PINK], vote: VIOLET },
    { x: 164, leaves: [PINK, PINK], vote: PINK },
];

function ForestArt() {
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            {TREES.map((t, i) => (
                <g key={i}>
                    <motion.path
                        d={`M${t.x} 16 L${t.x - 16} 44 M${t.x} 16 L${t.x + 16} 44`}
                        stroke="#94a3b8" strokeWidth="1.5" fill="none"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ delay: i * 0.25, duration: 0.6 }}
                    />
                    <circle cx={t.x} cy="14" r="5" fill="#e2e8f0" />
                    <motion.circle
                        cx={t.x - 16} cy="48" r="5" fill={t.leaves[0]}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.25 }}
                    />
                    <motion.circle
                        cx={t.x + 16} cy="48" r="5" fill={t.leaves[1]}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.25 }}
                    />
                    <motion.path
                        d={`M${t.x} 58 L${t.x} 90`}
                        stroke={t.vote} strokeWidth="1.5" strokeDasharray="3 3" fill="none"
                        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                        transition={{ delay: 1 + i * 0.15 }}
                    />
                    <motion.circle
                        cx={t.x} cy="100" r="8" fill={t.vote}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 + i * 0.15 }}
                    />
                </g>
            ))}
        </svg>
    );
}

// A decision tree: one question, then two branches, then leaves
function TreeArt() {
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <rect x="82" y="8" width="36" height="18" rx="5" fill="#8b5cf6" opacity="0.85" />
                <motion.path
                    d="M100 26 L60 60 M100 26 L140 60"
                    stroke="#475569"
                    strokeWidth="1.5"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                />
                <motion.path
                    d="M60 78 L40 104 M60 78 L80 104 M140 78 L120 104 M140 78 L160 104"
                    stroke="#475569"
                    strokeWidth="1.5"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                />
                <circle cx="40" cy="106" r="8" fill="#22d3ee" opacity="0.9" />
                <circle cx="80" cy="106" r="8" fill="#f472b6" opacity="0.9" />
                <circle cx="120" cy="106" r="8" fill="#f472b6" opacity="0.9" />
                <circle cx="160" cy="106" r="8" fill="#22d3ee" opacity="0.9" />
            </motion.g>
        </svg>
    );
}

// A regression line: a straight line through a scatter of points
function LineArt() {
    const points = A.map(([x, y]) => [x, y]).concat(B.map(([x, y]) => [x, y - 10]));
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            <motion.path
                d="M20 100 L180 24"
                stroke="#22d3ee"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
            />
            {points.map(([x, y], i) => (
                <motion.circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill="#8b5cf6"
                    opacity="0.8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.8 }}
                    transition={{ delay: 0.5 + i * 0.04 }}
                />
            ))}
        </svg>
    );
}

const art = {
    logistic_regression: LogisticArt,
    knn: KnnArt,
    random_forest: ForestArt,
    decision_tree: TreeArt,
    linear_regression: LineArt,
    ridge: LineArt,
    knn_regressor: KnnArt,
    random_forest_regressor: ForestArt,
    decision_tree_regressor: TreeArt,
};

/**
 * Fallback art for an algorithm we have not drawn yet. An empty box would
 * look like a bug, so we show a neutral sketch instead.
 */
function GenericArt() {
    return (
        <svg viewBox="0 0 200 120" className="h-full w-full">
            <g stroke="#334155" strokeWidth="1.5" fill="none">
                <circle cx="100" cy="60" r="34" strokeDasharray="4 6" />
                <path d="M78 60 L94 74 L124 46" stroke="#22d3ee" strokeWidth="2.5" />
            </g>
        </svg>
    );
}

export default function ModelArt({ id }) {
    const Art = art[id] || GenericArt;
    // The wrapper has to carry the height itself. Without it, the SVG's
    // "h-full" has nothing to fill and spills out of its box, straight over
    // the model name underneath.
    return (
        <div aria-hidden="true" className="h-full w-full overflow-hidden">
            <Art />
        </div>
    );
}