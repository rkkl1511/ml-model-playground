import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";

const MAX_MB = 10;

export default function Dropzone({ onFile, loading }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState("");

    function handleFile(file) {
        if (!file) return;
        // Quick checks in the browser so the user gets instant feedback.
        // The server still re-checks everything, because the browser can't be trusted.
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setError("Please choose a .csv file.");
            return;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
            setError(`That file is too large (max ${MAX_MB} MB).`);
            return;
        }
        setError("");
        onFile(file);
    }

    function onDrop(e) {
        e.preventDefault(); // otherwise the browser opens the file instead
        setDragging(false);
        if (!loading) handleFile(e.dataTransfer.files[0]);
    }

    return (
        <div>
            <motion.div
                onClick={() => !loading && inputRef.current.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                animate={{ scale: dragging ? 1.03 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${dragging
                        ? "border-neon-cyan bg-neon-cyan/10"
                        : "border-white/15 bg-white/[0.03] hover:border-neon-violet/60"
                    }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                        handleFile(e.target.files[0]);
                        e.target.value = ""; // lets you pick the same file twice in a row
                    }}
                />

                {/* pointer-events-none stops child elements from triggering dragleave flicker */}
                <div className="pointer-events-none flex flex-col items-center gap-4">
                    <div className="relative grid h-16 w-16 place-items-center">
                        <motion.span
                            className="absolute inset-0 rounded-full border border-neon-violet"
                            animate={{ scale: [1, 1.7], opacity: [0.6, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                        />
                        <motion.div
                            animate={{ y: dragging ? -8 : [0, -5, 0] }}
                            transition={dragging ? { duration: 0.2 } : { duration: 2.4, repeat: Infinity }}
                            className="grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-neon-violet to-neon-cyan"
                        >
                            <Upload size={28} />
                        </motion.div>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-3 text-slate-300">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-neon-cyan" />
                            Reading your data...
                        </div>
                    ) : (
                        <>
                            <p className="font-display text-xl font-bold">
                                {dragging ? "Drop it!" : "Drag and drop your CSV here"}
                            </p>
                            <p className="text-sm text-slate-400">
                                or <span className="text-neon-cyan">click to browse</span> · up to {MAX_MB} MB
                            </p>
                        </>
                    )}
                </div>
            </motion.div>

            {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}
        </div>
    );
}