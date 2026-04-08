import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Activity,
  Play,
  RotateCcw,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryItem {
  step: number;
  price: number;
  competitor_price: number;
  sales: number;
  profit: number;
  inventory: number;
}

interface State {
  current_price: number;
  competitor_price: number;
  inventory: number;
  demand_signal: number;
  step: number;
  total_profit: number;
  task: "easy" | "medium" | "hard";
  done: boolean;
}

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [inputPrice, setInputPrice] = useState<string>("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/state');
      const data = await res.json();
      setState(data);
    } catch (err) {
      setError("Failed to fetch state");
    }
  };

  const handleReset = async (task: string = "easy") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task })
      });
      const obs = await res.json();
      setHistory([]);
      await fetchState();
    } catch (err) {
      setError("Failed to reset environment");
    } finally {
      setLoading(false);
    }
  };

  const handleStep = async () => {
    if (!state || state.done) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parseFloat(inputPrice) })
      });
      const data = await res.json();
      
      const newHistoryItem: HistoryItem = {
        step: data.observation.step,
        price: data.observation.current_price,
        competitor_price: data.observation.competitor_price,
        sales: data.info.sales,
        profit: data.info.profit,
        inventory: data.observation.inventory
      };
      
      setHistory(prev => [...prev, newHistoryItem]);
      await fetchState();
    } catch (err) {
      setError("Failed to take step");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleReset("easy");
  }, []);

  if (!state) return <div className="flex items-center justify-center h-screen bg-slate-950 text-white">Loading Simulator...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="text-blue-500" />
              PriceSim RL Environment
            </h1>
            <p className="text-slate-400 mt-1">OpenEnv Specification Compliant Simulator</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={state.task}
              onChange={(e) => handleReset(e.target.value)}
            >
              <option value="easy">Easy Task</option>
              <option value="medium">Medium Task</option>
              <option value="hard">Hard Task</option>
            </select>
            <button 
              onClick={() => handleReset(state.task)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Profit" 
            value={`$${state.total_profit.toFixed(2)}`} 
            icon={<DollarSign className={state.total_profit >= 0 ? "text-green-500" : "text-red-500"} />}
            trend={state.total_profit >= 0 ? "+Profit" : "-Loss"}
            trendColor={state.total_profit >= 0 ? "text-green-500" : "text-red-500"}
          />
          <StatCard 
            title="Inventory" 
            value={state.inventory.toFixed(0)} 
            icon={<Package className="text-orange-500" />}
            subValue="units remaining"
          />
          <StatCard 
            title="Competitor Price" 
            value={`$${state.competitor_price.toFixed(2)}`} 
            icon={<TrendingUp className="text-red-500" />}
            subValue="Current market rate"
          />
          <StatCard 
            title="Current Step" 
            value={`${state.step}/30`} 
            icon={<Activity className="text-blue-500" />}
            subValue="Episode progress"
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-white">Agent Controls</h2>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-400">Set Price ($)</label>
                  <input 
                    type="number" 
                    value={inputPrice}
                    onChange={(e) => setInputPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-xl font-mono text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="50.00"
                    disabled={state.done}
                  />
                </div>

                <button 
                  onClick={handleStep}
                  disabled={state.done || loading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-lg transition-all",
                    state.done 
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 active:scale-95"
                  )}
                >
                  {loading ? "Processing..." : state.done ? "Episode Finished" : "Execute Step"}
                  {!loading && !state.done && <ChevronRight size={20} />}
                </button>
              </div>

              {state.done && (
                <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 flex gap-3 text-blue-200 text-sm">
                  <AlertCircle className="shrink-0" size={18} />
                  <p>Episode complete. Final profit: ${state.total_profit.toFixed(2)}. Reset to start a new trial.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 flex gap-3 text-red-200 text-sm">
                  <AlertCircle className="shrink-0" size={18} />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Task Description</h3>
              <p className="text-slate-200 leading-relaxed">
                {state.task === 'easy' && "In this mode, you have a monopoly. Demand is stable and there are no competitors to worry about. Find the optimal price to maximize your profit."}
                {state.task === 'medium' && "A competitor has entered the market. They will react to your pricing. If you price too high, you'll lose market share. If too low, your margins will suffer."}
                {state.task === 'hard' && "Complex market dynamics. Seasonal demand fluctuations, aggressive competitor pricing, and strict inventory limits. Requires strategic long-term planning."}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-6">Price History</h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="step" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="Your Price" />
                    <Line type="monotone" dataKey="competitor_price" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Competitor" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Sales & Demand</h2>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="step" hide />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Sales" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-6">Profit per Step</h2>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="step" hide />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }}
                      />
                      <Area type="monotone" dataKey="profit" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} name="Profit" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, subValue, trend, trendColor }: { title: string, value: string, icon: React.ReactNode, subValue?: string, trend?: string, trendColor?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-400">{title}</span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{value}</span>
        {trend && <span className={cn("text-xs font-medium", trendColor || "text-green-500")}>{trend}</span>}
      </div>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );
}

