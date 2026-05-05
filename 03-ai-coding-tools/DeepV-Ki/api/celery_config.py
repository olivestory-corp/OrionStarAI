"""
Celery configuration for DeepV-Ki async task processing.

Handles task queues, worker configuration, and result backend setup.
"""

import os
from celery import Celery
from kombu import Exchange, Queue
from datetime import timedelta

# Get Redis URL from environment, default to localhost
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# Create Celery application
celery_app = Celery('deepwiki')

# Configure Celery settings
celery_app.conf.update(
    # ===== Broker Settings =====
    broker_url=CELERY_BROKER_URL,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=10,

    # ===== Result Backend Settings =====
    result_backend=CELERY_RESULT_BACKEND,
    result_expires=3600,  # Results expire after 1 hour
    result_extended=True,  # Store task args and kwargs

    # ===== Task Settings =====
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_compression='gzip',

    # ===== Task Execution Settings =====
    task_soft_time_limit=600,      # 10 minutes soft limit (raise SoftTimeLimitExceeded)
    task_time_limit=900,           # 15 minutes hard limit (kill task)
    task_acks_late=True,           # Task acknowledged after execution
    task_reject_on_worker_lost=True,  # Re-queue task if worker dies

    # ===== Worker Settings =====
    worker_prefetch_multiplier=1,  # Each worker gets 1 task at a time
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks
    worker_disable_rate_limits=False,

    # ===== Queue Settings =====
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    task_queues=(
        Queue(
            'default',
            Exchange('default', type='direct'),
            routing_key='default',
            queue_arguments={'x-max-priority': 10}
        ),
        Queue(
            'high_priority',
            Exchange('priority', type='direct'),
            routing_key='priority.high',
            queue_arguments={'x-max-priority': 10}
        ),
        Queue(
            'low_priority',
            Exchange('priority', type='direct'),
            routing_key='priority.low',
            queue_arguments={'x-max-priority': 10}
        ),
    ),

    # ===== Task Routing =====
    task_routes={
        'tasks.generate_wiki_structure': {'queue': 'default'},
        'tasks.generate_wiki_pages': {'queue': 'default'},
        'tasks.sync_public_projects': {'queue': 'low_priority'},
    },

    # ===== Scheduled Tasks =====
    beat_scheduler='celery.beat:PersistentScheduler',

    # ===== Result Settings =====
    result_persistent=True,
    result_ignore_on_timeout=False,
)

# Task default settings
celery_app.conf.task_defaults = {
    'max_retries': 2,
    'default_retry_delay': 60,  # Retry after 60 seconds
}

# Define periodic tasks (if using Celery Beat)
from celery.schedules import crontab
celery_app.conf.beat_schedule = {
    # Sync public projects every hour (optional)
    # 'sync-public-projects': {
    #     'task': 'tasks.sync_public_projects',
    #     'schedule': timedelta(hours=1),
    # },
}


def get_celery_app():
    """Get the Celery application instance."""
    return celery_app
