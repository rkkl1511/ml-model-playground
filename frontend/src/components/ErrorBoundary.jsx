import { Component } from "react";
import { motion } from "framer-motion";

/**
 * Catches a crash in the tree below it and shows a message instead of a
 * blank screen.
 *
 * React unmounts the whole tree when a render throws. Without this, one
 * bad value in one panel takes the entire page down, and the user has no
 * idea what happened.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        // The console is the first place to look when something breaks.
        console.error("Something in the playground broke:", error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="mx-auto max-w-2xl px-6 py-24 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-10"
                >
                    <div className="mb-4 text-4xl">Something broke</div>
                    <p className="text-slate-400">
                        This part of the playground hit an error. The rest of the page is
                        still fine, so you can keep going.
                    </p>
                    <pre className="mt-6 overflow-x-auto rounded-xl bg-black/30 px-4 py-3 text-left text-xs text-rose-200">
                        {String(this.state.error?.message || this.state.error)}
                    </pre>
                    <button
                        type="button"
                        onClick={() => this.setState({ error: null })}
                        className="mt-6 rounded-xl bg-linear-to-r from-neon-violet to-neon-cyan px-6 py-3 font-semibold text-white"
                    >
                        Try again
                    </button>
                </motion.div>
            </div>
        );
    }
}
