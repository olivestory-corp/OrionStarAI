import logging
import weakref
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Any, List, Tuple, Dict
from uuid import uuid4

import adalflow as adal

from api.tools.embedder import get_embedder
from api.prompts import RAG_SYSTEM_PROMPT as system_prompt, RAG_TEMPLATE
from api.wiki_generator import clean_html_from_markdown, parse_wiki_structure_xml, get_default_structure, LANGUAGE_MAP

# Create our own implementation of the conversation classes
@dataclass
class UserQuery:
    query_str: str

@dataclass
class AssistantResponse:
    response_str: str

@dataclass
class DialogTurn:
    id: str
    user_query: UserQuery
    assistant_response: AssistantResponse

class CustomConversation:
    """Custom implementation of Conversation to fix the list assignment index out of range error"""

    def __init__(self):
        self.dialog_turns = []

    def append_dialog_turn(self, dialog_turn):
        """Safely append a dialog turn to the conversation"""
        if not hasattr(self, 'dialog_turns'):
            self.dialog_turns = []
        self.dialog_turns.append(dialog_turn)

# Import other adalflow components
from adalflow.components.retriever.faiss_retriever import FAISSRetriever
from api.config import configs
from api.data_pipeline import DatabaseManager

# Configure logging
logger = logging.getLogger(__name__)

# Maximum token limit for embedding models
MAX_INPUT_TOKENS = 7500  # Safe threshold below 8192 token limit

class Memory(adal.core.component.DataComponent):
    """Simple conversation management with a list of dialog turns."""

    def __init__(self):
        super().__init__()
        # Use our custom implementation instead of the original Conversation class
        self.current_conversation = CustomConversation()

    def call(self) -> Dict:
        """Return the conversation history as a dictionary."""
        all_dialog_turns = {}
        try:
            # Check if dialog_turns exists and is a list
            if hasattr(self.current_conversation, 'dialog_turns'):
                if self.current_conversation.dialog_turns:
                    logger.info(f"Memory content: {len(self.current_conversation.dialog_turns)} turns")
                    for i, turn in enumerate(self.current_conversation.dialog_turns):
                        if hasattr(turn, 'id') and turn.id is not None:
                            all_dialog_turns[turn.id] = turn
                            # logger.info(f"Added turn {i+1} with ID {turn.id} to memory")
                        else:
                            logger.warning(f"Skipping invalid turn object in memory: {turn}")
                else:
                    logger.info("Dialog turns list exists but is empty")
            else:
                logger.info("No dialog_turns attribute in current_conversation")
                # Try to initialize it
                self.current_conversation.dialog_turns = []
        except Exception as e:
            logger.error(f"Error accessing dialog turns: {str(e)}")
            # Try to recover
            try:
                self.current_conversation = CustomConversation()
                logger.info("Recovered by creating new conversation")
            except Exception as e2:
                logger.error(f"Failed to recover: {str(e2)}")

        logger.info(f"Returning {len(all_dialog_turns)} dialog turns from memory")
        return all_dialog_turns

    def add_dialog_turn(self, user_query: str, assistant_response: str) -> bool:
        """
        Add a dialog turn to the conversation history.

        Args:
            user_query: The user's query
            assistant_response: The assistant's response

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Create a new dialog turn using our custom implementation
            dialog_turn = DialogTurn(
                id=str(uuid4()),
                user_query=UserQuery(query_str=user_query),
                assistant_response=AssistantResponse(response_str=assistant_response),
            )

            # Make sure the current_conversation has the append_dialog_turn method
            if not hasattr(self.current_conversation, 'append_dialog_turn'):
                logger.warning("current_conversation does not have append_dialog_turn method, creating new one")
                # Initialize a new conversation if needed
                self.current_conversation = CustomConversation()

            # Ensure dialog_turns exists
            if not hasattr(self.current_conversation, 'dialog_turns'):
                logger.warning("dialog_turns not found, initializing empty list")
                self.current_conversation.dialog_turns = []

            # Safely append the dialog turn
            self.current_conversation.dialog_turns.append(dialog_turn)
            logger.info(f"Successfully added dialog turn, now have {len(self.current_conversation.dialog_turns)} turns")
            return True

        except Exception as e:
            logger.error(f"Error adding dialog turn: {str(e)}")
            # Try to recover by creating a new conversation
            try:
                self.current_conversation = CustomConversation()
                dialog_turn = DialogTurn(
                    id=str(uuid4()),
                    user_query=UserQuery(query_str=user_query),
                    assistant_response=AssistantResponse(response_str=assistant_response),
                )
                self.current_conversation.dialog_turns.append(dialog_turn)
                logger.info("Recovered from error by creating new conversation")
                return True
            except Exception as e2:
                logger.error(f"Failed to recover from error: {str(e2)}")
                return False


from dataclasses import dataclass, field

@dataclass
class RAGAnswer(adal.DataClass):
    rationale: str = field(default="", metadata={"desc": "Chain of thoughts for the answer."})
    answer: str = field(default="", metadata={"desc": "Answer to the user query, formatted in markdown for beautiful rendering with react-markdown. DO NOT include ``` triple backticks fences at the beginning or end of your answer."})

    __output_fields__ = ["rationale", "answer"]

class RAG(adal.Component):
    """RAG with one repo.
    If you want to load a new repos, call prepare_retriever(repo_url_or_path) first."""

    def __init__(self, provider="google", model=None, use_s3: bool = False):  # noqa: F841 - use_s3 is kept for compatibility
        """
        Initialize the RAG component.

        Args:
            provider: Model provider to use (google, openai, openrouter, ollama)
            model: Model name to use with the provider
            use_s3: Whether to use S3 for database storage (default: False)
        """
        super().__init__()

        self.provider = provider
        self.model = model

        # Import the helper functions
        from api.config import get_embedder_config, is_ollama_embedder

        # Determine if we're using Ollama embedder based on configuration
        self.is_ollama_embedder = is_ollama_embedder()

        # Check if Ollama model exists before proceeding
        if self.is_ollama_embedder:
            from api.ollama_patch import check_ollama_model_exists
            from api.config import get_embedder_config

            embedder_config = get_embedder_config()
            if embedder_config and embedder_config.get("model_kwargs", {}).get("model"):
                model_name = embedder_config["model_kwargs"]["model"]
                if not check_ollama_model_exists(model_name):
                    raise Exception(f"Ollama model '{model_name}' not found. Please run 'ollama pull {model_name}' to install it.")

        # Initialize components
        self.memory = Memory()
        self.embedder = get_embedder()

        self_weakref = weakref.ref(self)
        # Patch: ensure query embedding is always single string for Ollama
        def single_string_embedder(query):
            # Accepts either a string or a list, always returns embedding for a single string
            if isinstance(query, list):
                if len(query) != 1:
                    raise ValueError("Ollama embedder only supports a single string")
                query = query[0]
            instance = self_weakref()
            assert instance is not None, "RAG instance is no longer available, but the query embedder was called."
            return instance.embedder(input=query)

        # Use single string embedder for Ollama, regular embedder for others
        self.query_embedder = single_string_embedder if self.is_ollama_embedder else self.embedder

        self.initialize_db_manager()

        # Set up the output parser
        data_parser = adal.DataClassParser(data_class=RAGAnswer, return_data_class=True)

        # Format instructions to ensure proper output structure
        format_instructions = data_parser.get_output_format_str() + """

IMPORTANT FORMATTING RULES:
1. DO NOT include your thinking or reasoning process in the output
2. Provide only the final, polished answer
3. DO NOT include ```markdown fences at the beginning or end of your answer
4. DO NOT wrap your response in any kind of fences
5. Start your response directly with the content
6. The content will already be rendered as markdown
7. Do not use backslashes before special characters like [ ] { } in your answer
8. When listing tags or similar items, write them as plain text without escape characters
9. For pipe characters (|) in text, write them directly without escaping them"""

        # Get model configuration based on provider and model
        from api.config import get_model_config
        generator_config = get_model_config(self.provider, self.model)

        # Set up the main generator
        self.generator = adal.Generator(
            template=RAG_TEMPLATE,
            prompt_kwargs={
                "output_format_str": format_instructions,
                "conversation_history": self.memory(),
                "system_prompt": system_prompt,
                "contexts": None,
            },
            model_client=generator_config["model_client"](),
            model_kwargs=generator_config["model_kwargs"],
            output_processors=data_parser,
        )


    def initialize_db_manager(self):
        """Initialize the database manager with local storage"""
        self.db_manager = DatabaseManager()
        self.transformed_docs = []

    def _validate_and_filter_embeddings(self, documents: List) -> List:
        """
        Validate embeddings and filter out documents with invalid or mismatched embedding sizes.

        Args:
            documents: List of documents with embeddings

        Returns:
            List of documents with valid embeddings of consistent size
        """
        if not documents:
            logger.warning("No documents provided for embedding validation")
            return []

        valid_documents = []
        embedding_sizes = {}

        # First pass: collect all embedding sizes and count occurrences
        for i, doc in enumerate(documents):
            if not hasattr(doc, 'vector') or doc.vector is None:
                logger.warning(f"Document {i} has no embedding vector, skipping")
                continue

            try:
                if isinstance(doc.vector, list):
                    embedding_size = len(doc.vector)
                elif hasattr(doc.vector, 'shape'):
                    embedding_size = doc.vector.shape[0] if len(doc.vector.shape) == 1 else doc.vector.shape[-1]
                elif hasattr(doc.vector, '__len__'):
                    embedding_size = len(doc.vector)
                else:
                    logger.warning(f"Document {i} has invalid embedding vector type: {type(doc.vector)}, skipping")
                    continue

                if embedding_size == 0:
                    logger.warning(f"Document {i} has empty embedding vector, skipping")
                    continue

                embedding_sizes[embedding_size] = embedding_sizes.get(embedding_size, 0) + 1

            except Exception as e:
                logger.warning(f"Error checking embedding size for document {i}: {str(e)}, skipping")
                continue

        if not embedding_sizes:
            logger.error("No valid embeddings found in any documents")
            return []

        # Find the most common embedding size (this should be the correct one)
        target_size = max(embedding_sizes.keys(), key=lambda k: embedding_sizes[k])
        logger.info(f"Target embedding size: {target_size} (found in {embedding_sizes[target_size]} documents)")

        # Log all embedding sizes found
        for size, count in embedding_sizes.items():
            if size != target_size:
                logger.warning(f"Found {count} documents with incorrect embedding size {size}, will be filtered out")

        # Second pass: filter documents with the target embedding size
        for i, doc in enumerate(documents):
            if not hasattr(doc, 'vector') or doc.vector is None:
                continue

            try:
                if isinstance(doc.vector, list):
                    embedding_size = len(doc.vector)
                elif hasattr(doc.vector, 'shape'):
                    embedding_size = doc.vector.shape[0] if len(doc.vector.shape) == 1 else doc.vector.shape[-1]
                elif hasattr(doc.vector, '__len__'):
                    embedding_size = len(doc.vector)
                else:
                    continue

                if embedding_size == target_size:
                    valid_documents.append(doc)
                else:
                    # Log which document is being filtered out
                    file_path = getattr(doc, 'meta_data', {}).get('file_path', f'document_{i}')
                    # logger.warning(f"Filtering out document '{file_path}' due to embedding size mismatch: {embedding_size} != {target_size}")

            except Exception as e:
                file_path = getattr(doc, 'meta_data', {}).get('file_path', f'document_{i}')
                logger.warning(f"Error validating embedding for document '{file_path}': {str(e)}, skipping")
                continue

        logger.info(f"Embedding validation complete: {len(valid_documents)}/{len(documents)} documents have valid embeddings")

        if len(valid_documents) == 0:
            logger.error("No documents with valid embeddings remain after filtering")
        elif len(valid_documents) < len(documents):
            filtered_count = len(documents) - len(valid_documents)
            logger.warning(f"Filtered out {filtered_count} documents due to embedding issues")

        return valid_documents

    def prepare_retriever(self, repo_url_or_path: str, type: str = "github", access_token: str = None,
                      excluded_dirs: List[str] = None, excluded_files: List[str] = None,
                      included_dirs: List[str] = None, included_files: List[str] = None,
                      force_refresh: bool = False):
        """
        Prepare the retriever for a repository.
        Will load database from local storage if available, unless force_refresh is True.

        Args:
            repo_url_or_path: URL or local path to the repository
            access_token: Optional access token for private repositories
            excluded_dirs: Optional list of directories to exclude from processing
            excluded_files: Optional list of file patterns to exclude from processing
            included_dirs: Optional list of directories to include exclusively
            included_files: Optional list of file patterns to include exclusively
            force_refresh: If True, force regeneration by ignoring cached embeddings
        """
        self.initialize_db_manager()
        self.repo_url_or_path = repo_url_or_path
        self.transformed_docs = self.db_manager.prepare_database(
            repo_url_or_path,
            type,
            access_token,
            is_ollama_embedder=self.is_ollama_embedder,
            excluded_dirs=excluded_dirs,
            excluded_files=excluded_files,
            included_dirs=included_dirs,
            included_files=included_files,
            force_refresh=force_refresh
        )
        logger.info(f"Loaded {len(self.transformed_docs)} documents for retrieval")

        # Validate and filter embeddings to ensure consistent sizes
        self.transformed_docs = self._validate_and_filter_embeddings(self.transformed_docs)

        if not self.transformed_docs:
            raise ValueError("No valid documents with embeddings found. Cannot create retriever.")

        logger.info(f"Using {len(self.transformed_docs)} documents with valid embeddings for retrieval")

        # 保存 documents 供 wiki 生成使用
        self.documents = self.transformed_docs

        try:
            # Use the appropriate embedder for retrieval
            retrieve_embedder = self.query_embedder if self.is_ollama_embedder else self.embedder
            self.retriever = FAISSRetriever(
                **configs["retriever"],
                embedder=retrieve_embedder,
                documents=self.transformed_docs,
                document_map_func=lambda doc: doc.vector,
            )
            logger.info("FAISS retriever created successfully")
        except Exception as e:
            logger.error(f"Error creating FAISS retriever: {str(e)}")
            # Try to provide more specific error information
            if "All embeddings should be of the same size" in str(e):
                logger.error("Embedding size validation failed. This suggests there are still inconsistent embedding sizes.")
                # Log embedding sizes for debugging
                sizes = []
                for i, doc in enumerate(self.transformed_docs[:10]):  # Check first 10 docs
                    if hasattr(doc, 'vector') and doc.vector is not None:
                        try:
                            if isinstance(doc.vector, list):
                                size = len(doc.vector)
                            elif hasattr(doc.vector, 'shape'):
                                size = doc.vector.shape[0] if len(doc.vector.shape) == 1 else doc.vector.shape[-1]
                            elif hasattr(doc.vector, '__len__'):
                                size = len(doc.vector)
                            else:
                                size = "unknown"
                            sizes.append(f"doc_{i}: {size}")
                        except:
                            sizes.append(f"doc_{i}: error")
                logger.error(f"Sample embedding sizes: {', '.join(sizes)}")
            raise

    def generate_structure(self, repo_url_or_path: str, type: str, language: str = "en", comprehensive: bool = True) -> Dict[str, Any]:
        """
        Generate wiki structure using RAG documents.
        """
        logger.info(f"Generating wiki structure for {repo_url_or_path}")

        # Extract file tree and readme from documents
        file_tree = ""
        readme = ""

        if hasattr(self, 'documents') and self.documents:
            # Generate file tree
            file_paths = []
            for doc in self.documents:
                if hasattr(doc, 'meta_data') and doc.meta_data:
                    file_path = doc.meta_data.get('file_path', '')
                    if file_path:
                        file_paths.append(file_path)

            file_tree = "\n".join(sorted(file_paths))

            # Extract README
            for doc in self.documents:
                if hasattr(doc, 'meta_data') and doc.meta_data:
                    file_path = doc.meta_data.get('file_path', '').lower()
                    if 'readme' in file_path:
                        readme = str(doc.text) if hasattr(doc, 'text') else str(doc)
                        break

        # Prepare task info for wiki_generator functions
        # We need to mock the 'task' dict that wiki_generator expects
        from urllib.parse import urlparse

        if repo_url_or_path.startswith(('http://', 'https://')):
            parsed = urlparse(repo_url_or_path)
            path_parts = parsed.path.strip('/').split('/')
            if path_parts and path_parts[-1].endswith('.git'):
                path_parts[-1] = path_parts[-1][:-4]

            if path_parts:
                repo_name = path_parts[-1]
                owner = '/'.join(path_parts[:-1]) if len(path_parts) > 1 else 'unknown'
            else:
                repo_name = 'unknown'
                owner = 'unknown'
        else:
            # Handle local path case
            parts = repo_url_or_path.rstrip('/').split('/')
            repo_name = parts[-1]
            owner = parts[-2] if len(parts) > 1 else 'unknown'

        task_mock = {
            'task_id': str(uuid4()),
            'repo_name': repo_name,
            'owner': owner,
            'language': language,
            'is_comprehensive': comprehensive,
            'provider': self.provider,
            'model': self.model
        }

        # We can reuse the logic from wiki_generator.py by importing generate_wiki_structure
        # But generate_wiki_structure is a standalone function that calls the LLM itself.
        # So we can just call it!

        from api.wiki_generator import generate_wiki_structure as original_generate_structure

        documents_count = len(self.documents) if hasattr(self, 'documents') else 0

        pages_structure = original_generate_structure(task_mock, documents_count, file_tree, readme)

        return {
            'title': f"{repo_name} Wiki",
            'description': f"Documentation for {repo_name}",
            'pages': pages_structure
        }

    def generate_page_content(self, page: Dict[str, Any], language: str = "en", comprehensive: bool = True) -> str:
        """
        Generate content for a single wiki page.
        """
        page_title = page.get('title', 'Untitled')
        logger.info(f"Generating content for page: {page_title}")

        # 1. Retrieve relevant code
        relevant_code = ""
        file_paths = []

        if hasattr(self, 'retriever') and self.retriever:
            try:
                query = f"{page.get('title', '')} {page.get('description', '')}"
                retrieved_docs = self.retriever.call(input=query, top_k=10)

                if retrieved_docs and len(retrieved_docs) > 0:
                    code_snippets = []

                    # Process retrieved docs
                    for retriever_output in retrieved_docs:
                        if hasattr(retriever_output, 'doc_indices') and retriever_output.doc_indices:
                            doc_indices = retriever_output.doc_indices

                            if hasattr(self, 'documents') and self.documents:
                                for doc_idx in doc_indices:
                                    if 0 <= doc_idx < len(self.documents):
                                        doc = self.documents[doc_idx]

                                        # Extract text
                                        doc_text = None
                                        if hasattr(doc, 'text'):
                                            doc_text = str(doc.text)
                                        elif isinstance(doc, dict) and 'text' in doc:
                                            doc_text = str(doc['text'])
                                        elif isinstance(doc, str):
                                            doc_text = doc

                                        if doc_text:
                                            code_snippets.append(doc_text)

                                        # Extract file path
                                        file_path = None
                                        if hasattr(doc, 'meta_data') and doc.meta_data:
                                            file_path = doc.meta_data.get('file_path', '')
                                        elif isinstance(doc, dict) and 'meta_data' in doc:
                                            file_path = doc['meta_data'].get('file_path', '')

                                        if file_path and file_path not in file_paths:
                                            file_paths.append(file_path)

                    if code_snippets:
                        relevant_code = "\n\n---\n\n".join(code_snippets[:5])
            except Exception as e:
                logger.error(f"Failed to retrieve code for page {page_title}: {e}")

        # 2. Generate content using wiki_generator logic
        from api.wiki_generator import generate_page_content as original_generate_page_content

        task_mock = {
            'task_id': str(uuid4()),
            'language': language,
            'provider': self.provider,
            'model': self.model
        }

        return original_generate_page_content(task_mock, page, relevant_code, file_paths)

    def call(self, query: str, language: str = "en") -> Tuple[List]:
        """
        Process a query using RAG.

        Args:
            query: The user's query

        Returns:
            Tuple of (RAGAnswer, retrieved_documents)
        """
        try:
            retrieved_documents = self.retriever(query)

            # Fill in the documents
            retrieved_documents[0].documents = [
                self.transformed_docs[doc_index]
                for doc_index in retrieved_documents[0].doc_indices
            ]

            return retrieved_documents

        except Exception as e:
            logger.error(f"Error in RAG call: {str(e)}")

            # Create error response
            error_response = RAGAnswer(
                rationale="Error occurred while processing the query.",
                answer=f"I apologize, but I encountered an error while processing your question. Please try again or rephrase your question."
            )
            return error_response, []
