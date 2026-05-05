"""
自定义异常类

所有业务异常都应该继承自这些类，便于统一处理和日志记录。
"""


class DeepWikiException(Exception):
    """DeepV-Ki 基础异常类"""

    def __init__(self, message: str, error_code: str = "UNKNOWN", details: dict = None):
        """
        Args:
            message: 用户友好的错误消息
            error_code: 错误代码（用于日志和客户端识别）
            details: 额外的技术细节（用于调试）
        """
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class RepositoryError(DeepWikiException):
    """仓库相关错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="REPO_ERROR", details=details)


class InvalidRepositoryError(RepositoryError):
    """仓库 URL 或配置无效"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="INVALID_REPO")
        self.error_code = "INVALID_REPO"


class RepositoryNotFoundError(RepositoryError):
    """仓库不存在"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="REPO_NOT_FOUND")
        self.error_code = "REPO_NOT_FOUND"


class RepositoryAccessError(RepositoryError):
    """仓库访问权限不足"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="REPO_ACCESS_DENIED")
        self.error_code = "REPO_ACCESS_DENIED"


class GitLabAPIError(DeepWikiException):
    """GitLab API 错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="GITLAB_API_ERROR", details=details)


class GitLabAuthenticationError(GitLabAPIError):
    """GitLab 认证失败"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="GITLAB_AUTH_FAILED")
        self.error_code = "GITLAB_AUTH_FAILED"


class TaskError(DeepWikiException):
    """任务相关错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="TASK_ERROR", details=details)


class TaskNotFoundError(TaskError):
    """任务不存在"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="TASK_NOT_FOUND")
        self.error_code = "TASK_NOT_FOUND"


class TaskTimeoutError(TaskError):
    """任务执行超时"""

    def __init__(self, message: str, timeout_seconds: int = None, details: dict = None):
        if timeout_seconds:
            message = f"{message} (timeout: {timeout_seconds}s)"
        super().__init__(message, error_code="TASK_TIMEOUT", details=details)
        self.error_code = "TASK_TIMEOUT"
        self.timeout_seconds = timeout_seconds


class RAGError(DeepWikiException):
    """RAG 系统错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="RAG_ERROR", details=details)


class EmbeddingError(RAGError):
    """嵌入生成错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="EMBEDDING_ERROR")
        self.error_code = "EMBEDDING_ERROR"


class WikiGenerationError(DeepWikiException):
    """Wiki 生成错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="WIKI_GEN_ERROR", details=details)


class AIProviderError(DeepWikiException):
    """AI 提供商 API 错误"""

    def __init__(self, message: str, provider: str = None, details: dict = None):
        if provider:
            message = f"[{provider}] {message}"
        super().__init__(message, error_code="AI_PROVIDER_ERROR", details=details)
        self.provider = provider


class ConfigurationError(DeepWikiException):
    """配置错误"""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, error_code="CONFIG_ERROR", details=details)


class MissingEnvironmentVariableError(ConfigurationError):
    """缺少必需的环境变量"""

    def __init__(self, var_name: str):
        message = f"Missing required environment variable: {var_name}"
        super().__init__(message, error_code="MISSING_ENV_VAR")
        self.error_code = "MISSING_ENV_VAR"
        self.var_name = var_name
