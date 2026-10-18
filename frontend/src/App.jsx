import { useEffect, useState } from "react";

export default function App() {
    // "loading" | "online" | "offline"
    const [apiStatus, setApiStatus] = useState("loading");

    // useEffect runs once after the first render: we ping the backend.
    useEffect(() => {
        fetch("/api/health")
            .then((res) => res.json())
            .then(() => setApiStatus("online"))
            .catch(() => setApiStatus("offline"));
    }, []);

    return (
        <main className="page">
            <h1>ML Model Playground</h1>
            <p className="tagline">
                Upload a dataset, pick an algorithm, train, and see the results.
            </p>
            <div className={`badge badge-${apiStatus}`}>
                API: {apiStatus === "loading" ? "checking..." : apiStatus}
            </div>
        </main>
    );
}