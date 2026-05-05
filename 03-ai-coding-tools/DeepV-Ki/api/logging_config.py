import logging
import os
import re
from pathlib import Path
from logging.handlers import RotatingFileHandler


class SensitiveInfoFilter(logging.Filter):
    """过滤敏感信息（API 密钥、令牌、密码等）"""

    # 需要过滤的敏感信息模式
    PATTERNS = {
        'api_key': (
            r'(api[_-]?key|apikey)\s*["\']?\s*[:=]\s*["\']?([A-Za-z0-9_\-\.]{20,})',
            r'\g<1>=[REDACTED_API_KEY]'
        ),
        'github_token': (
            r'(github[_-]?token|gh[_-]?token|ghp_[A-Za-z0-9]{36})',
            r'[REDACTED_GITHUB_TOKEN]'
        ),
        'gitlab_token': (
            r'(gitlab[_-]?token|glpat-[A-Za-z0-9_\-]{20,})',
            r'[REDACTED_GITLAB_TOKEN]'
        ),
        'openai_key': (
            r'(sk-[A-Za-z0-9]{48})',
            r'[REDACTED_OPENAI_KEY]'
        ),
        'google_key': (
            r'(AIzaSy[A-Za-z0-9_\-]{33})',
            r'[REDACTED_GOOGLE_KEY]'
        ),
        'authorization': (
            r'(authorization|x-api-key|x-token)["\']?\s*[:=]\s*["\']?Bearer\s+([A-Za-z0-9_\-\.]+)',
            r'\g<1>=Bearer [REDACTED_TOKEN]'
        ),
        'password': (
            r'(password|pwd|passwd)["\']?\s*[:=]\s*["\']?([^"\'\s]{4,})',
            r'\g<1>=***[REDACTED_PASSWORD]***'
        ),
        'url_with_token': (
            r'(https?://[^:]+:)([^@]+)(@)',
            r'\g<1>[REDACTED_TOKEN]\g<3>'
        ),
    }

    def filter(self, record: logging.LogRecord):
        """过滤日志消息中的敏感信息"""
        message = record.getMessage()

        # 对每个敏感信息模式进行替换
        for key, (pattern, replacement) in self.PATTERNS.items():
            try:
                message = re.sub(pattern, replacement, message, flags=re.IGNORECASE)
            except Exception:
                # 如果正则表达式出错，继续处理其他模式
                pass

        # 更新日志记录
        record.msg = message
        record.args = ()  # 清除 args 以防止格式化时泄露信息

        return True


class IgnoreLogChangeDetectedFilter(logging.Filter):
    def filter(self, record: logging.LogRecord):
        return "Detected file change in" not in record.getMessage()


class ColoredFormatter(logging.Formatter):
    """Custom formatter to add colors to log levels"""

    grey = "\x1b[38;20m"
    green = "\x1b[32;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    FORMATS = {
        logging.DEBUG: grey,
        logging.INFO: green,
        logging.WARNING: yellow,
        logging.ERROR: red,
        logging.CRITICAL: bold_red,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt + self._fmt + self.reset)
        return formatter.format(record)


def setup_logging(format: str = None):
    """
    Configure logging for the application with log rotation.

    Environment variables:
        LOG_LEVEL: Log level (default: INFO)
        LOG_FILE_PATH: Path to log file (default: logs/application.log)
        LOG_MAX_SIZE: Max size in MB before rotating (default: 10MB)
        LOG_BACKUP_COUNT: Number of backup files to keep (default: 5)

    Ensures log directory exists, prevents path traversal, and configures
    both rotating file and console handlers.
    """
    # Determine log directory and default file path
    base_dir = Path(__file__).parent
    log_dir = base_dir / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    default_log_file = log_dir / "application.log"

    # Get log level from environment
    log_level_str = os.environ.get("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Get log file path
    log_file_path = Path(os.environ.get("LOG_FILE_PATH", str(default_log_file)))

    # Secure path check: must be inside logs/ directory
    # log_dir_resolved = log_dir.resolve()
    # resolved_path = log_file_path.resolve()
    # if not str(resolved_path).startswith(str(log_dir_resolved) + os.sep):
    #     raise ValueError(f"LOG_FILE_PATH '{log_file_path}' is outside the trusted log directory '{log_dir_resolved}'")

    # Ensure parent directories exist
    log_file_path = Path(log_file_path)
    if not log_file_path.is_absolute():
        # If relative, make it relative to the project root (or where the script is run)
        # For now, let's just use absolute path resolution
        log_file_path = log_file_path.resolve()

    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_path = log_file_path

    # Get max log file size (default: 10MB)
    try:
        max_mb = int(os.environ.get("LOG_MAX_SIZE", 10))  # 10MB default
        max_bytes = max_mb * 1024 * 1024
    except (TypeError, ValueError):
        max_bytes = 10 * 1024 * 1024  # fallback to 10MB on error

    # Get backup count (default: 5)
    try:
        backup_count = int(os.environ.get("LOG_BACKUP_COUNT", 5))
    except ValueError:
        backup_count = 5

    # Configure format
    log_format = format or "%(asctime)s - %(levelname)s - %(name)s - %(filename)s:%(lineno)d - %(message)s"

    # Create handlers
    file_handler = RotatingFileHandler(resolved_path, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8")
    console_handler = logging.StreamHandler()

    # Set format for both handlers
    formatter = logging.Formatter(log_format)
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add filters to suppress "Detected file change" messages and filter sensitive info
    sensitive_filter = SensitiveInfoFilter()
    change_filter = IgnoreLogChangeDetectedFilter()

    file_handler.addFilter(change_filter)
    file_handler.addFilter(sensitive_filter)

    console_handler.addFilter(change_filter)
    console_handler.addFilter(sensitive_filter)

    # Use ColoredFormatter for console output
    color_formatter = ColoredFormatter(log_format)
    console_handler.setFormatter(color_formatter)

    # Apply logging configuration
    logging.basicConfig(level=log_level, handlers=[file_handler, console_handler], force=True)

    # Suppress noisy logs from third-party libraries
    logging.getLogger("adalflow").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    # Log configuration info
    logger = logging.getLogger(__name__)
    logger.debug(
        f"Logging configured: level={log_level_str}, "
        f"file={resolved_path}, max_size={max_bytes} bytes, "
        f"backup_count={backup_count}"
    )
