"""OpenRouter API client using OpenAI library."""

import logging
from typing import Dict, Any
from openai import OpenAI
from api.openai_client import OpenAIClient

log = logging.getLogger(__name__)


class OpenRouterClient(OpenAIClient):
    """OpenRouter client that inherits from OpenAIClient.

    Since OpenRouter is compatible with OpenAI's API, we can reuse the OpenAIClient
    implementation and just configure it with OpenRouter's base URL.
    """

    def __init__(self, *args, **kwargs) -> None:
        """Initialize the OpenRouter client."""
        # Call parent init
        super().__init__(*args, **kwargs)

        # Ensure _input_type is set
        if not hasattr(self, "_input_type"):
            self._input_type = kwargs.get("input_type", "text")

        # Re-initialize sync client with OpenRouter settings
        self.sync_client = self.init_sync_client()
        self.async_client = None

    def init_sync_client(self) -> OpenAI:
        """Initialize the synchronous OpenAI client configured for OpenRouter."""
        from api.config import OPENROUTER_API_KEY

        api_key = OPENROUTER_API_KEY
        if not api_key:
            log.warning("OPENROUTER_API_KEY not configured")
            api_key = ""

        # Initialize OpenAI client with OpenRouter settings
        return OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )

    def init_async_client(self) -> OpenAI:
        """Initialize the asynchronous OpenAI client configured for OpenRouter."""
        from api.config import OPENROUTER_API_KEY

        api_key = OPENROUTER_API_KEY
        if not api_key:
            log.warning("OPENROUTER_API_KEY not configured")
            api_key = ""

        # Initialize async OpenAI client with OpenRouter settings
        return OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1"
        )
