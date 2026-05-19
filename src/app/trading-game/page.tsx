import { GameDashboardClient } from "./GameDashboardClient";

export const metadata = {
  title: "Trading Game | EA Market Place",
  description: "Live Simulation Trading Dashboard",
};

export default function TradingGamePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30 overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/20 blur-[120px]" />
      </div>
      
      <main className="container mx-auto px-4 py-12 max-w-7xl relative z-10">
        <GameDashboardClient />
      </main>
    </div>
  );
}
