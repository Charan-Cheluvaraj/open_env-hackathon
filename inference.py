import os
import asyncio
import json
import httpx
from openai import OpenAI
from typing import List, Optional

# --- Configuration ---
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:7860")
HF_TOKEN = os.getenv("HF_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", HF_TOKEN)
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
MODEL_NAME = os.getenv("MODEL_NAME", "openai/gpt-4o-mini" if "openrouter" in OPENAI_BASE_URL else "gpt-4")

# --- Logging Helpers ---
def log_start(task: str, env: str, model: str):
    print(f"[START] task={task} env={env} model={model}", flush=True)

def log_step(step: int, action: str, reward: float, done: bool, error: Optional[str]):
    error_str = error if error else "null"
    done_str = str(done).lower()
    # Note: Exact spacing as per sample: [STEP] followed by two spaces
    print(f"[STEP]  step={step} action={action} reward={reward:.2f} done={done_str} error={error_str}", flush=True)

def log_end(success: bool, steps: int, score: float, rewards: List[float]):
    success_str = str(success).lower()
    rewards_str = ",".join([f"{r:.2f}" for r in rewards])
    print(f"[END]   success={success_str} steps={steps} score={score:.2f} rewards={rewards_str}", flush=True)

# --- Model Interaction ---
def get_model_price(client: OpenAI, step: int, obs: dict, last_reward: float, history: List[str]) -> float:
    prompt = f"""
    You are a pricing manager. Your goal is to maximize total profit over 30 steps.
    Current Step: {step}/30
    Current Observation: {json.dumps(obs)}
    Last Reward: {last_reward}
    
    History:
    {chr(10).join(history[-5:])}
    
    Respond with ONLY a single number representing the price you want to set.
    """
    try:
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=10,
            temperature=0,
        )
        content = completion.choices[0].message.content.strip()
        # Extract number
        import re
        match = re.search(r"(\d+\.?\d*)", content)
        if match:
            return float(match.group(1))
        return 50.0 # Default fallback
    except Exception as e:
        return 50.0

# --- Main Loop ---
async def run_task(task_name: str):
    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    
    async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30.0) as http:
        log_start(task=task_name, env="PriceSim", model=MODEL_NAME)
        
        # Reset
        try:
            resp = await http.post("/reset", json={"task": task_name})
            obs = resp.json()
        except Exception as e:
            log_end(success=False, steps=0, score=0.0, rewards=[])
            return

        history = []
        rewards = []
        done = False
        step = 0
        last_reward = 0.0
        final_score = 0.0

        while not done and step < 30:
            step += 1
            
            # Get action from model
            price = get_model_price(client, step, obs, last_reward, history)
            action_str = f"set_price({price:.2f})"
            
            # Step
            try:
                resp = await http.post("/step", json={"price": price})
                result = resp.json()
                
                obs = result['observation']
                reward = result['reward']
                done = result['done']
                info = result.get('info', {})
                error = result.get('error', None)
                
                rewards.append(reward)
                last_reward = reward
                if done:
                    final_score = info.get('score', 0.0)
                
                log_step(step=step, action=action_str, reward=reward, done=done, error=error)
                history.append(f"Step {step}: Price {price:.2f} -> Reward {reward:.2f}")
                
            except Exception as e:
                log_step(step=step, action=action_str, reward=0.0, done=True, error=str(e))
                break
                
        success = final_score >= 0.7
        log_end(success=success, steps=step, score=final_score, rewards=rewards)

async def main():
    for task in ["easy", "medium", "hard"]:
        await run_task(task)

if __name__ == "__main__":
    asyncio.run(main())
