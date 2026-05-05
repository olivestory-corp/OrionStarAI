"""
Task-related Pydantic models for wiki generation.

Defines request/response models for the async task API.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List, Literal
from enum import Enum
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task execution status."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class ProcessingStage(str, Enum):
    """Wiki generation processing stage."""
    VALIDATION = "validation"
    CLONING = "cloning"
    EXTRACTION = "extraction"
    EMBEDDING = "embedding"
    STRUCTURE = "structure"
    PAGES = "pages"
    ADAPTING = "adapting_diagrams"
    CACHING = "caching"
    COMPLETED = "completed"
    LOADING = "loading"
    PREPARING = "preparing"
    STRUCTURE_COMPLETED = "structure_completed"


class WikiGenerationRequest(BaseModel):
    """Request body for wiki generation."""

    repo_url: str = Field(
        ...,
        description="Repository URL",
        example="https://github.com/user/repo"
    )
    repo_type: Literal['github', 'gitlab', 'bitbucket', 'gerrit'] = Field(
        ...,
        description="Repository platform type"
    )
    token: Optional[str] = Field(
        None,
        description="Personal access token for private repositories"
    )
    provider: str = Field(
        default='google',
        description="AI provider (google, openai, openrouter, azure, ollama, bedrock, dashscope)"
    )
    model: str = Field(
        default='gemini-2.5-flash',
        description="Model name for the selected provider"
    )
    language: str = Field(
        default='english',
        description="Documentation language"
    )
    comprehensive: bool = Field(
        default=True,
        description="Generate comprehensive or concise wiki"
    )
    excluded_dirs: List[str] = Field(
        default_factory=list,
        description="Directories to exclude from analysis"
    )
    excluded_files: List[str] = Field(
        default_factory=list,
        description="File patterns to exclude from analysis"
    )
    included_dirs: List[str] = Field(
        default_factory=list,
        description="Directories to include in analysis"
    )
    included_files: List[str] = Field(
        default_factory=list,
        description="File patterns to include in analysis"
    )
    force_refresh: bool = Field(
        default=False,
        description="Force refresh: delete cached repository and re-download from source"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "repo_url": "https://github.com/user/awesome-project",
                "repo_type": "github",
                "token": "ghp_xxxxxxxxxxxxx",
                "provider": "google",
                "model": "gemini-2.5-flash",
                "language": "english",
                "comprehensive": True,
                "excluded_dirs": ["node_modules", ".git", "dist"],
                "excluded_files": ["*.log", "*.tmp"],
                "included_dirs": ["src", "lib"],
                "included_files": []
            }
        }


class WikiTaskProgress(BaseModel):
    """Task progress information."""

    progress: int = Field(
        ...,
        ge=0,
        le=100,
        description="Progress percentage (0-100)"
    )
    stage: str = Field(
        ...,
        description="Current processing stage"
    )
    message: str = Field(
        ...,
        description="Human-readable status message"
    )
    pages_generated: Optional[int] = Field(
        None,
        description="Number of pages generated (for pages generation stage)"
    )
    pages_total: Optional[int] = Field(
        None,
        description="Total number of pages to generate"
    )
    timestamp: str = Field(
        ...,
        description="Timestamp of the update (ISO format)"
    )


class WikiTaskInfo(BaseModel):
    """Complete task information."""

    task_id: str = Field(
        ...,
        description="Unique task identifier (UUID)"
    )
    status: TaskStatus = Field(
        ...,
        description="Current task status"
    )
    progress: int = Field(
        default=0,
        ge=0,
        le=100,
        description="Progress percentage"
    )
    current_stage: str = Field(
        default='validation',
        description="Current processing stage"
    )
    message: str = Field(
        default='',
        description="Human-readable status message"
    )

    # Timing information
    created_at: str = Field(
        ...,
        description="Task creation timestamp (ISO format)"
    )
    started_at: Optional[str] = Field(
        None,
        description="Task start timestamp (ISO format)"
    )
    completed_at: Optional[str] = Field(
        None,
        description="Task completion timestamp (ISO format)"
    )

    # Request parameters
    repo_url: str = Field(..., description="Repository URL")
    repo_type: str = Field(..., description="Repository type")
    provider: str = Field(..., description="AI provider")
    model: str = Field(..., description="Model name")
    language: str = Field(..., description="Documentation language")
    comprehensive: bool = Field(..., description="Comprehensive or concise")

    # Progress details
    pages_generated: int = Field(
        default=0,
        description="Number of pages generated"
    )
    pages_total: Optional[int] = Field(
        None,
        description="Total number of pages"
    )

    # Error information
    error: Optional[str] = Field(
        None,
        description="Error message if task failed"
    )
    error_code: Optional[str] = Field(
        None,
        description="Error code if task failed"
    )

    # Result
    result: Optional[Dict[str, Any]] = Field(
        None,
        description="Task result (available when status=success)"
    )

    # Resource tracking
    duration_seconds: Optional[float] = Field(
        None,
        description="Total duration in seconds"
    )


class WikiTaskResponse(BaseModel):
    """Response for task creation."""

    task_id: str = Field(
        ...,
        description="Unique task identifier"
    )
    status: TaskStatus = Field(
        default=TaskStatus.PENDING,
        description="Initial status"
    )
    created_at: str = Field(
        ...,
        description="Creation timestamp"
    )
    redirect_url: str = Field(
        ...,
        description="URL to task status page"
    )


class WikiTaskStatusResponse(BaseModel):
    """Response for task status query."""

    task_id: str
    status: str  # One of TaskStatus values, as string
    progress: int
    current_stage: str
    message: str
    pages_generated: Optional[int] = None
    pages_total: Optional[int] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


class TaskListResponse(BaseModel):
    """Response for listing tasks."""

    total: int = Field(..., description="Total number of tasks")
    tasks: List[WikiTaskInfo] = Field(..., description="List of tasks")


class TaskCancelResponse(BaseModel):
    """Response for task cancellation."""

    task_id: str
    status: str = "cancelled"
    message: str = "Task cancelled successfully"
