import logging
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

# Global dictionary to store cost trackers in memory
_cost_trackers: Dict[str, 'CostTracker'] = {}

class CostTracker:
    """
    Tracks costs for a specific task (e.g., Wiki generation).
    Accumulates LLM and embedding costs.
    """
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.embedding_tokens = 0
        self.embedding_cost = 0.0
        self.llm_tokens = 0
        self.llm_cost = 0.0

    def add_embedding_cost(self, tokens: int, cost: float):
        """Add embedding usage and cost."""
        self.embedding_tokens += tokens
        self.embedding_cost += cost

    def add_llm_cost(self, prompt_tokens: int, completion_tokens: int, total_tokens: int, cost: float):
        """Add LLM usage and cost."""
        self.llm_tokens += total_tokens
        self.llm_cost += cost

    def get_total_cost(self) -> float:
        """Get total accumulated cost."""
        return self.embedding_cost + self.llm_cost

    def get_cost_message(self) -> str:
        """
        Generate a message summarizing the cost.
        This is used to update the task status message.
        """
        total_cost = self.get_total_cost()
        total_tokens = self.llm_tokens + self.embedding_tokens

        msg = "Wiki generation completed successfully!"

        if total_cost > 0:
            msg += f" Total cost: ${total_cost:.5f} (LLM: ${self.llm_cost:.5f}, Embedding: ${self.embedding_cost:.5f})"

        msg += f" Total tokens: {total_tokens} (LLM: {self.llm_tokens}, Embedding: {self.embedding_tokens})"

        return msg

    def log_summary(self):
        """Log a summary of the costs."""
        total_tokens = self.llm_tokens + self.embedding_tokens
        logger.info(f"[Task {self.task_id}] Cost Summary: Total=${self.get_total_cost():.5f}, Tokens={total_tokens} (LLM={self.llm_tokens}, Embedding={self.embedding_tokens})")

def get_cost_tracker(task_id: str) -> CostTracker:
    """Get or create a cost tracker for a task."""
    if task_id not in _cost_trackers:
        _cost_trackers[task_id] = CostTracker(task_id)
    return _cost_trackers[task_id]

def clear_cost_tracker(task_id: str):
    """Remove a cost tracker from memory."""
    if task_id in _cost_trackers:
        del _cost_trackers[task_id]