"""
Celery tasks for DeepV-Ki wiki generation.

Defines async tasks for:
- Wiki structure generation
- Wiki pages generation
- Progress tracking and error handling
"""

import logging
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from celery import Task, current_task
from celery.exceptions import SoftTimeLimitExceeded, MaxRetriesExceededError

from api.celery_config import celery_app
from api.rag import RAG
from api.data_pipeline import download_repo, read_all_documents
from api.mermaid_adapter import adapt_mermaid_diagrams, render_mermaid_in_markdown
from api.gitlab_db import GitLabDatabase

logger = logging.getLogger(__name__)


class WikiGenerationTaskBase(Task):
    """
    Base class for wiki generation tasks.

    Handles common functionality like error reporting and resource cleanup.
    """

    autoretry_for = (Exception,)
    retry_kwargs = {'max_retries': 2}
    retry_backoff = True
    retry_backoff_max = 600
    retry_jitter = True

    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """Called when task is retried."""
        logger.warning(f"Task {task_id} retrying due to: {exc}")

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails after all retries."""
        logger.error(f"Task {task_id} failed permanently: {exc}")

    def on_success(self, result, task_id, args, kwargs):
        """Called when task succeeds."""
        logger.info(f"Task {task_id} completed successfully")


@celery_app.task(
    bind=True,
    base=WikiGenerationTaskBase,
    name='tasks.generate_wiki_structure',
    queue='default',
)
def generate_wiki_structure(
    self,
    repo_url: str,
    repo_type: str,
    token: Optional[str] = None,
    provider: str = 'google',
    model: str = 'gemini-2.5-flash',
    language: str = 'english',
    comprehensive: bool = True,
    excluded_dirs: Optional[List[str]] = None,
    excluded_files: Optional[List[str]] = None,
    included_dirs: Optional[List[str]] = None,
    included_files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Generate wiki structure asynchronously.

    This is the first phase of wiki generation:
    1. Validate request (5%)
    2. Clone repository (15%)
    3. Extract documents (35%)
    4. Generate embeddings (65%)
    5. Generate structure (85%)
    6. Cache intermediate results (95%)
    7. Complete (100%)

    Args:
        repo_url: Repository URL
        repo_type: Type of repository (github, gitlab, bitbucket, gerrit)
        token: Optional access token for private repos
        provider: AI provider (google, openai, openrouter, etc.)
        model: Model name for the provider
        language: Language for documentation
        comprehensive: Generate comprehensive or concise wiki
        excluded_dirs: Directories to exclude
        excluded_files: Files to exclude
        included_dirs: Directories to include
        included_files: Files to include

    Returns:
        Dict with structure_id and pages_total

    Raises:
        ValueError: If validation fails
        SoftTimeLimitExceeded: If task takes too long
        Exception: If generation fails
    """
    task_id = self.request.id
    repo_path = None

    try:
        logger.info(f"[{task_id}] Starting wiki structure generation")
        logger.info(f"[{task_id}] Repository: {repo_url}")
        logger.info(f"[{task_id}] Provider: {provider}, Model: {model}")

        # ===== Stage 1: Validation (5%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 5,
                'stage': 'validation',
                'message': 'Validating request...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.debug(f"[{task_id}] Validating wiki request")
        if not repo_url:
            raise ValueError('Repository URL is required')
        if repo_type not in ['github', 'gitlab', 'bitbucket', 'gerrit']:
            raise ValueError(f'Invalid repo type: {repo_type}')

        # ===== Stage 2: Repository Cloning (15%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 15,
                'stage': 'cloning',
                'message': f'Cloning repository from {repo_url}...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Cloning repository")
        repo_path = download_repo(
            repo_url=repo_url,
            repo_type=repo_type,
            token=token,
            task_id=task_id
        )
        logger.info(f"[{task_id}] Repository cloned to {repo_path}")

        # ===== Stage 3: Document Extraction (35%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 35,
                'stage': 'extraction',
                'message': 'Extracting documents from repository...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Extracting documents")
        documents = read_all_documents(
            path=repo_path,
            excluded_dirs=excluded_dirs or [],
            excluded_files=excluded_files or [],
            included_dirs=included_dirs or [],
            included_files=included_files or [],
        )
        logger.info(f"[{task_id}] Extracted {len(documents)} documents")

        # ===== Stage 4: Embedding Generation (65%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 65,
                'stage': 'embedding',
                'message': f'Generating embeddings for {len(documents)} documents...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Initializing RAG and preparing retriever")
        rag = RAG(
            provider=provider,
            model=model,
            language=language
        )

        rag.prepare_retriever(
            repo_url_or_path=repo_path,
            type=repo_type,
            access_token=token,
            documents=documents
        )
        logger.info(f"[{task_id}] Embeddings generated and retriever prepared")

        # ===== Stage 5: Structure Generation (85%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 85,
                'stage': 'structure',
                'message': 'Generating wiki structure...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Generating wiki structure")
        structure = rag.generate_structure(
            repo_url_or_path=repo_path,
            type=repo_type,
            language=language,
            comprehensive=comprehensive
        )

        pages_count = len(structure.get('pages', []))
        logger.info(f"[{task_id}] Wiki structure generated with {pages_count} pages")

        # ===== Stage 6: Cache Intermediate Results (95%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 95,
                'stage': 'caching',
                'message': 'Saving intermediate results...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        # Generate structure_id for next phase
        structure_id = str(uuid.uuid4())
        logger.debug(f"[{task_id}] Generated structure_id: {structure_id}")

        # TODO: Cache structure and retriever in Redis for next phase
        # For now, we'll store them in memory and pass via return value

        # ===== Stage 7: Complete (100%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 100,
                'stage': 'structure_completed',
                'message': 'Wiki structure generated successfully!',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Wiki structure generation completed")

        return {
            'status': 'structure_completed',
            'structure_id': structure_id,
            'pages_total': pages_count,
            'repo_url': repo_url,
            'repo_type': repo_type,
            'provider': provider,
            'model': model,
            'language': language,
            'comprehensive': comprehensive,
            # Return structure in result for next task
            'structure': structure,
            'repo_path': repo_path,
        }

    except SoftTimeLimitExceeded:
        logger.error(f"[{task_id}] Task timeout after 10 minutes")
        self.update_state(
            state='FAILURE',
            meta={
                'error': 'Task timeout: Wiki structure generation took too long (>10 minutes)',
                'error_code': 'TASK_TIMEOUT',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        raise

    except MaxRetriesExceededError as e:
        logger.error(f"[{task_id}] Max retries exceeded: {e}")
        self.update_state(
            state='FAILURE',
            meta={
                'error': f'Task failed after retries: {str(e)}',
                'error_code': 'MAX_RETRIES_EXCEEDED',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        raise

    except Exception as e:
        logger.error(f"[{task_id}] Task failed with error: {e}", exc_info=True)
        self.update_state(
            state='FAILURE',
            meta={
                'error': str(e),
                'error_code': 'STRUCTURE_GENERATION_FAILED',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        raise


@celery_app.task(
    bind=True,
    base=WikiGenerationTaskBase,
    name='tasks.generate_wiki_pages',
    queue='default',
)
def generate_wiki_pages(
    self,
    structure_result: Dict[str, Any],
    owner: str,
    repo: str,
) -> Dict[str, Any]:
    """
    Generate wiki pages content asynchronously.

    This is the second phase of wiki generation:
    1. Load structure and retriever (10%)
    2. Generate pages (10%-90%)
    3. Adapt diagrams (90%-95%)
    4. Save to cache (95%-99%)
    5. Complete (100%)

    Args:
        structure_result: Result from generate_wiki_structure task
        owner: Repository owner
        repo: Repository name

    Returns:
        Dict with result containing wiki URL and page count

    Raises:
        Exception: If page generation fails
    """
    task_id = self.request.id

    try:
        logger.info(f"[{task_id}] Starting wiki pages generation")
        logger.info(f"[{task_id}] Repository: {owner}/{repo}")

        # ===== Stage 1: Load Structure (10%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 10,
                'stage': 'loading',
                'message': 'Loading wiki structure...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.debug(f"[{task_id}] Loading structure from previous task")
        structure = structure_result.get('structure')
        repo_path = structure_result.get('repo_path')
        repo_url = structure_result.get('repo_url')
        repo_type = structure_result.get('repo_type')
        provider = structure_result.get('provider')
        model = structure_result.get('model')
        language = structure_result.get('language')
        comprehensive = structure_result.get('comprehensive', True)

        if not structure:
            raise ValueError('Structure not found in task result')

        # ===== Stage 2: Prepare RAG (15%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 15,
                'stage': 'preparing',
                'message': 'Preparing RAG system...',
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.debug(f"[{task_id}] Initializing RAG for page generation")
        rag = RAG(
            provider=provider,
            model=model,
            language=language
        )

        # ===== Stage 3: Generate Pages (15%-90%) =====
        pages = structure.get('pages', [])
        pages_total = len(pages)
        all_pages = {}

        logger.info(f"[{task_id}] Generating {pages_total} pages")

        for idx, page in enumerate(pages):
            progress = 15 + int((75 * idx) / max(pages_total, 1))
            page_id = page.get('id', f'page_{idx}')
            page_title = page.get('title', 'Untitled')

            self.update_state(
                state='PROGRESS',
                meta={
                    'progress': progress,
                    'stage': 'pages',
                    'message': f'Generating page: {page_title}',
                    'pages_generated': idx,
                    'pages_total': pages_total,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )

            logger.info(f"[{task_id}] Generating page {idx + 1}/{pages_total}: {page_title}")

            try:
                # Generate page content
                page_content = rag.generate_page_content(
                    page=page,
                    language=language,
                    comprehensive=comprehensive
                )

                # 渲染 Mermaid 图表为 SVG 并嵌入内容
                page_content = render_mermaid_in_markdown(
                    content=page_content,
                    task_id=task_id
                )

                all_pages[page_id] = {
                    'id': page_id,
                    'title': page_title,
                    'content': page_content,
                    'filePaths': page.get('filePaths', []),
                    'importance': page.get('importance', 'medium'),
                    'relatedPages': page.get('relatedPages', [])
                }

                logger.debug(f"[{task_id}] Page {page_id} generated successfully")

            except Exception as e:
                logger.error(f"[{task_id}] Failed to generate page {page_id}: {e}")
                # Continue with next page on error
                all_pages[page_id] = {
                    'id': page_id,
                    'title': page_title,
                    'content': f"Error generating page: {str(e)}",
                    'filePaths': page.get('filePaths', []),
                    'importance': page.get('importance', 'medium'),
                    'relatedPages': page.get('relatedPages', [])
                }

        # ===== Stage 4: Adapt Diagrams (90%-95%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 90,
                'stage': 'adapting_diagrams',
                'message': 'Adapting diagrams for rendering...',
                'pages_generated': pages_total,
                'pages_total': pages_total,
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] All pages generated, adapting diagrams")

        # ===== Stage 5: Save to Cache (95%-99%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 95,
                'stage': 'caching',
                'message': 'Saving wiki to cache...',
                'pages_generated': pages_total,
                'pages_total': pages_total,
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Saving wiki to cache")

        # Save to database cache
        db = GitLabDatabase()
        cache_key = f"{owner}:{repo}:{language}:{comprehensive}"
        db.save_wiki_cache(
            key=cache_key,
            wiki_data={
                'structure': structure,
                'pages': all_pages,
                'repo_url': repo_url,
                'provider': provider,
                'model': model,
                'language': language,
                'comprehensive': comprehensive,
                'generated_at': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Wiki cached successfully")

        # ===== Stage 6: Complete (100%) =====
        self.update_state(
            state='PROGRESS',
            meta={
                'progress': 100,
                'stage': 'completed',
                'message': 'Wiki generation completed!',
                'pages_generated': pages_total,
                'pages_total': pages_total,
                'timestamp': datetime.utcnow().isoformat()
            }
        )

        logger.info(f"[{task_id}] Wiki generation completed successfully")

        return {
            'status': 'wiki_completed',
            'owner': owner,
            'repo': repo,
            'pages_generated': pages_total,
            'language': language,
            'provider': provider,
            'model': model,
            'wiki_url': f'/{owner}/{repo}'
        }

    except Exception as e:
        logger.error(f"[{task_id}] Task failed with error: {e}", exc_info=True)
        self.update_state(
            state='FAILURE',
            meta={
                'error': str(e),
                'error_code': 'PAGES_GENERATION_FAILED',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        raise


@celery_app.task(
    bind=True,
    name='tasks.chain_wiki_generation',
    queue='default',
)
def chain_wiki_generation(
    self,
    repo_url: str,
    repo_type: str,
    token: Optional[str] = None,
    provider: str = 'google',
    model: str = 'gemini-2.5-flash',
    language: str = 'english',
    comprehensive: bool = True,
    excluded_dirs: Optional[List[str]] = None,
    excluded_files: Optional[List[str]] = None,
    included_dirs: Optional[List[str]] = None,
    included_files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Orchestrate wiki generation workflow.

    This task chains structure and pages generation.
    It could be replaced with Celery's chain() or group() primitives.

    For now, we use this to handle the complete workflow synchronously
    within a single task for simplicity.
    """
    try:
        # Extract owner and repo from URL
        from urllib.parse import urlparse

        parsed = urlparse(repo_url)
        path_parts = parsed.path.strip('/').split('/')

        # Remove .git from the last part if present
        if path_parts and path_parts[-1].endswith('.git'):
            path_parts[-1] = path_parts[-1][:-4]

        if path_parts:
            repo_name = path_parts[-1]
            # Owner is everything else joined by /
            owner = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else 'unknown'
        else:
            # Fallback for empty path
            repo_name = 'unknown'
            owner = 'unknown'

        # Phase 1: Generate structure
        structure_result = generate_wiki_structure(
            repo_url=repo_url,
            repo_type=repo_type,
            token=token,
            provider=provider,
            model=model,
            language=language,
            comprehensive=comprehensive,
            excluded_dirs=excluded_dirs,
            excluded_files=excluded_files,
            included_dirs=included_dirs,
            included_files=included_files,
        )

        # Phase 2: Generate pages
        pages_result = generate_wiki_pages(
            structure_result=structure_result,
            owner=owner,
            repo=repo_name,
        )

        return pages_result

    except Exception as e:
        logger.error(f"Chain wiki generation failed: {e}", exc_info=True)
        raise
