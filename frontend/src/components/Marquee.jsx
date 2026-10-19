const algos = [
    "Logistic Regression",
    "K-Nearest Neighbors",
    "Random Forest",
    "Decision Tree",
    "SVM",
    "Naive Bayes",
    "Gradient Boosting",
];

export default function Marquee() {
    // Two copies side by side: when the first scrolls out, the second is exactly where it started
    const items = [...algos, ...algos];

    return (
        <div className="marquee fade-edges overflow-hidden border-y border-white/5 py-5">
            <div className="marquee-track flex w-max">
                {items.map((name, i) => (
                    <span
                        key={i}
                        className="glass mr-4 whitespace-nowrap rounded-full px-5 py-2 text-sm text-slate-300"
                    >
                        {name}
                    </span>
                ))}
            </div>
        </div>
    );
}