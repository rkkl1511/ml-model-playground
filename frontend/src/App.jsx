import AnimatedBackground from "./components/AnimatedBackground";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";

export default function App() {
    return (
        <div className="relative min-h-screen">
            <AnimatedBackground />
            <Navbar />
            <main>
                <Hero />
                <Features />
                <HowItWorks />
            </main>
            <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
                Built step by step, one commit at a time.
            </footer>
        </div>
    );
}