import AnimatedBackground from "./components/AnimatedBackground";
import NeuralBackground from "./components/NeuralBackground";
import CursorGlow from "./components/CursorGlow";
import ScrollProgress from "./components/ScrollProgress";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Playground from "./components/Playground";

export default function App() {
    return (
        <div className="relative min-h-screen">
            <ScrollProgress />
            <AnimatedBackground />
            <NeuralBackground />
            <CursorGlow />
            <Navbar />
            <main>
                <Hero />
                <Marquee />
                <Playground />
                <Features />
                <HowItWorks />
            </main>
            <footer className="border-t border-white/5 py-8 text-center text-sm text-slate-500">
                Built step by step, one commit at a time.(Rome wasn't built in a day either.) <br />
            </footer>
        </div>
    );
}