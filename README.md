---
title: Lazarus Task Env
emoji: 🚀
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
tags:
- openenv
---

# PriceSim: Real-World Dynamic Pricing RL Environment

## Motivation
Pricing is a critical task in every business. Finding the optimal price that balances sales volume and profit margin while reacting to competitors and inventory constraints is a complex challenge humans face daily. PriceSim provides a realistic simulation of this task for AI agents to learn and evaluate their strategic decision-making capabilities.

## Action Space
The agent provides a single continuous value:
- `price` (float): The price to set for the product in the current step (Range: 0.0 to 1000.0).

## Observation Space
The agent receives a dictionary of values:
- `current_price` (float): The price set by the agent in the previous step.
- `competitor_price` (float): The current price of the main competitor.
- `inventory` (float): The number of units remaining in stock.
- `demand_signal` (float): A signal indicating market demand strength (1.0 = normal).
- `step` (int): The current step in the episode (0 to 30).

## Tasks
1. **Easy**: Monopoly scenario. Constant demand, no competitor reaction. Goal: Find the static optimal price.
2. **Medium**: Competitive market. A competitor reacts to your price changes. Goal: Maintain market share while preserving margins.
3. **Hard**: Dynamic environment. Seasonal demand fluctuations, aggressive competitor, and limited inventory. Goal: Strategic long-term inventory clearance at maximum profit.

## Reward Function
The reward is provided at each step and is calculated as:
`reward = max(0, profit / 200)`
Where `profit = sales * (price - cost)`. This provides a partial progress signal throughout the trajectory.

## Grader & Scoring
Each task has a deterministic grader that calculates a final score (0.0 to 1.0) based on the total profit achieved compared to a theoretical maximum for that task.
- Success is defined as achieving a score >= 0.7.

## Setup & Usage
1. **Build**: `docker build -t pricesim .`
2. **Run**: `docker run -p 3000:3000 pricesim`
3. **Inference**: `python3 inference.py` (Requires `OPENAI_API_KEY`, `API_BASE_URL`, `MODEL_NAME`)

## Baseline Scores
- **Easy**: 0.95
- **Medium**: 0.82
- **Hard**: 0.65
