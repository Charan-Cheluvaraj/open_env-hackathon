import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { z } from "zod";

// --- OpenEnv Models (using Zod instead of Pydantic) ---

const ActionSchema = z.object({
  price: z.number().min(0).max(1000),
});

const ObservationSchema = z.object({
  current_price: z.number(),
  competitor_price: z.number(),
  inventory: z.number(),
  demand_signal: z.number(),
  step: z.number(),
});

const TaskSchema = z.enum(["easy", "medium", "hard"]);

// --- Simulator Logic ---

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

class PriceSimulator {
  private state: State;
  private max_steps = 30;
  private cost = 20;

  constructor(task: "easy" | "medium" | "hard" = "easy") {
    this.state = this.init_state(task);
  }

  private init_state(task: "easy" | "medium" | "hard"): State {
    return {
      current_price: 50,
      competitor_price: task === "easy" ? 1000 : (task === "medium" ? 55 : 45),
      inventory: 100,
      demand_signal: 1.0,
      step: 0,
      total_profit: 0,
      task: task,
      done: false,
    };
  }

  reset(task: "easy" | "medium" | "hard" = "easy") {
    this.state = this.init_state(task);
    return this.get_observation();
  }

  get_observation() {
    return {
      current_price: this.state.current_price,
      competitor_price: this.state.competitor_price,
      inventory: this.state.inventory,
      demand_signal: this.state.demand_signal,
      step: this.state.step,
    };
  }

  private calculate_score(): number {
    // Grader logic: Score 0.0 to 1.0
    // Easy: Max possible profit is around 100 * (1000-20) if demand is high, 
    // but demand is limited. Let's say max profit is around 5000.
    // Medium: Max profit around 2500.
    // Hard: Max profit around 1500.
    const targets = {
      easy: 5000,
      medium: 2500,
      hard: 1500
    };
    const target = targets[this.state.task];
    const score = Math.min(Math.max(this.state.total_profit / target, 0), 1);
    return parseFloat(score.toFixed(2));
  }

  step(action: { price: number }) {
    if (this.state.done) {
      throw new Error("Environment is done. Call reset().");
    }

    const price = Math.max(0, action.price);
    this.state.current_price = price;
    this.state.step += 1;

    // Market Dynamics
    let base_demand = 10;
    if (this.state.task === "hard") {
      // Seasonal demand
      base_demand = 10 + 5 * Math.sin(this.state.step / 5);
    }

    // Price Elasticity: Demand drops as price increases relative to competitor
    const price_ratio = price / this.state.competitor_price;
    let demand = base_demand * Math.exp(-2 * (price_ratio - 1));
    
    // Random noise (deterministic seed could be used for reproducibility, but hackathon allows some variance)
    // For "deterministic grader", we should probably minimize randomness or use a seed.
    const noise = 1.0; // Simplified for deterministic grading
    demand *= noise;
    
    // Cap demand by inventory
    const sales = Math.min(demand, this.state.inventory);
    const profit = sales * (price - this.cost);

    this.state.inventory -= sales;
    this.state.total_profit += profit;

    // Competitor Reaction
    if (this.state.task !== "easy") {
      // Competitor tries to match or undercut
      const target = price * 0.95;
      this.state.competitor_price = this.state.competitor_price * 0.8 + target * 0.2;
    }

    // Check if done
    if (this.state.step >= this.max_steps || this.state.inventory <= 0) {
      this.state.done = true;
    }

    const reward = Math.max(0, profit / 200); // Partial progress signal

    return {
      observation: this.get_observation(),
      reward: parseFloat(Math.min(reward, 1.0).toFixed(2)),
      done: this.state.done,
      info: {
        sales: parseFloat(sales.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        total_profit: parseFloat(this.state.total_profit.toFixed(2)),
        score: this.state.done ? this.calculate_score() : 0.0
      },
    };
  }

  get_state() {
    return this.state;
  }
}

// --- Express Server ---

async function startServer() {
  const app = express();
  const PORT = 7860;;

  app.use(cors());
  app.use(express.json());

  let simulator = new PriceSimulator();

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", environment: "PriceSim" });
  });

  // OpenEnv API
  app.post("/reset", (req, res) => {
    const { task } = req.body;
    const validatedTask = TaskSchema.safeParse(task);
    const taskToUse = validatedTask.success ? validatedTask.data : "easy";
    const obs = simulator.reset(taskToUse);
    res.json(obs);
  });

  app.post("/step", (req, res) => {
    const action = ActionSchema.safeParse(req.body);
    if (!action.success) {
      return res.status(400).json({ error: "Invalid action", details: action.error });
    }
    try {
      const result = simulator.step(action.data);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/state", (req, res) => {
    res.json(simulator.get_state());
  });

  // Headless mode: No Vite middleware, just serve static if needed or just API
  // For the hackathon, we only need the API.
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PriceSim OpenEnv Server running on port ${PORT}`);
  });
}

startServer();
