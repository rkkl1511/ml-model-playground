import { useEffect, useState } from "react";

const styles = {
    loading: { dot: "bg-amber-400", text: "text-amber-300", label: "Connecting" },
    online: { dot: "bg-emerald-400", text: "text-emerald-300", label: "API online" },
    offline: { dot: "bg-rose-400", text: "text-rose-300", label: "API offline" },
};

export default function ApiBadge() {
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        fetch("/api/health")
            .then((res) => res.json())
            .then(() => setStatus("online"))
            .catch(() => setStatus("offline"));
    }, []);

    const s = styles[status];

    return (
        <div className={`glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${s.text}`}>
            <span className="relative flex h-2 w-2">
                {status === "online" && (
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${s.dot}`} />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
            </span>
            {s.label}
        </div>
    );
}