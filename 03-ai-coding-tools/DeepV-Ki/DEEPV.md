# DeepV Project Context: DeepV-Ki - AI-Powered Wiki Generator

This document provides a comprehensive overview of the DeepV-Ki project architecture, technologies, and conventions for the DeepV Code AI Assistant.

## 1. Project Overview and Purpose

DeepV-Ki is a full-stack application designed to automatically generate comprehensive, interactive documentation (Wiki) for code repositories using various Large Language Models (LLMs). It supports multiple repository types (GitHub, GitLab, etc.) and features a Retrieval-Augmented Generation (RAG) system for code Q&A.

## 2. Main Technologies and Architecture

The project uses a decoupled architecture:

| Component | Technology | Framework/Library |
| :--- | :--- | :--- |
| **Backend** | Python 3.12+ | FastAPI, Uvicorn, Celery, Redis, SQLAlchemy |
| **Frontend** | TypeScript | Next.js 15 (App Router), React 19, Tailwind CSS |
| **AI Core** | Python | `adalflow` (LLM orchestration), FAISS (Vector Store) |

### 2.1. Backend Architecture (Python/FastAPI)

*   **Framework:** FastAPI is used for the RESTful API and streaming endpoints.
*   **Asynchronous Processing:** Heavy tasks (Wiki generation) are handled by a **Celery** task queue, using **Redis** as the broker.
*   **Core Logic:**
    *   `api/wiki_generator.py`: Handles the core logic for generating the Wiki structure and content, including intelligent model switching for token management.
    *   `api/rag.py`: Implements the RAG system using `adalflow` and `FAISSRetriever` for code-based Q&A.
    *   `api/mermaid_renderer.py`: Manages server-side rendering of Mermaid diagrams (via `mermaid.ink` or Playwright).
*   **Data Persistence:** Uses **SQLite** for metadata and **FAISS** for vector indexing, with data persisted locally in the `~/.adalflow` directory.

### 2.2. Frontend Architecture (Next.js/React/TypeScript)

*   **Framework:** Next.js 15 utilizing the **App Router** structure (`src/app/`).
*   **Styling:** Utility-first styling is enforced using **Tailwind CSS**.
*   **State Management:** Primarily uses **React Context** (`src/contexts/`) and custom hooks (`src/hooks/`) for domain-specific state (e.g., `GitLabContext`, `LanguageContext`).
*   **Key Components:**
    *   `src/components/Markdown.tsx`: Renders Markdown, handles code highlighting, and intercepts file links to display source code.
    *   `src/components/Mermaid.tsx`: Manages the complex, dynamic rendering of Mermaid diagrams.
    *   `src/components/Ask.tsx`: The streaming chat interface for the RAG system.

### 2.3. Inter-Service Communication

The frontend communicates with the backend via **Next.js API Proxy Rewrites** defined in `next.config.ts`. All frontend requests to `/api/*` are transparently forwarded to the backend's `SERVER_BASE_URL` (default: `http://localhost:8001`), eliminating CORS issues and simplifying the client-side code.

## 3. LLM/AI Integration and Configuration

The project is designed for maximum LLM flexibility:

*   **Abstraction:** All LLM interactions are abstracted through the `adalflow` framework and dedicated client classes (e.g., `api/openai_client.py`, `api/azureai_client.py`).
*   **Configuration:** Model selection, provider credentials, and parameters are managed via JSON files in the `api/config/` directory:
    *   `generator.json`: Defines available LLM providers and models for content generation.
    *   `embedder.json`: Configures the embedding model used for the RAG system.
    *   `repo.json`: Defines file filtering and processing rules for repository analysis.

## 4. Key Build, Run, and Test Commands

### 4.1. Local Development

| Action | Command | Notes |
| :--- | :--- | :--- |
| **Backend Start** | `python -m api.main` | Requires Python 3.12+ and dependencies from `pyproject.toml`. Runs on port 8001. |
| **Frontend Install** | `npm install` | Installs Next.js/React dependencies. |
| **Frontend Start** | `npm run dev` | Starts the Next.js development server on port 3000. |
| **Frontend Build** | `npm run build` | Creates a production build. |
| **Linting** | `npm run lint` | Runs Next.js linting. |

### 4.2. Deployment

The project is optimized for **Docker** deployment using `docker-compose.yml`. The frontend uses the `output: 'standalone'` configuration in `next.config.ts` for minimal image size.

## 5. Directory Structure and Key Files

| Path | Purpose |
| :--- | :--- |
| `api/` | **Backend Source:** Contains all Python/FastAPI code. |
| `api/main.py` | Backend entry point (Uvicorn server). |
| `api/config/` | JSON configuration files for LLMs, RAG, and repository processing. |
| `api/routers/` | FastAPI route definitions (e.g., `chat.py`, `wiki.py`). |
| `src/` | **Frontend Source:** Contains all Next.js/React/TypeScript code. |
| `src/app/` | Next.js App Router pages and layouts. |
| `src/components/` | Reusable React components (e.g., `Ask.tsx`, `Mermaid.tsx`). |
| `src/hooks/` | Custom React hooks (e.g., `useTasks.ts`, `useAuth.ts`). |
| `next.config.ts` | Next.js configuration, including critical API proxy rewrites. |
| `pyproject.toml` | Python dependency management and project metadata. |
| `package.json` | Node.js/Frontend dependency management and scripts. |

## 6. Development Conventions

*   **Language:** TypeScript is mandatory for the frontend. Python with type hinting is standard for the backend.
*   **Styling:** Tailwind CSS is the sole styling framework.
*   **Architecture:** Adherence to the Next.js App Router and a clear separation of concerns between the decoupled frontend and backend services.
*   **Internationalization:** Uses `next-intl` for multi-language support.

## DeepV Code Added Memories
- DEEPV.md generated by /init command on 2025-11-22 12:00:00
- **⚠️ CRITICAL AGENT RULES (Added 2025-11-22) ⚠️**
  1. **🚫 NO .md FILES:** Do not create .md files without explicit permission. Output directly to chat.
  2. **❓ CLARIFY:** Clarify ambiguous instructions before execution.
  3. **✅ CONFIRM:** Confirm major architectural/logic plans before implementation.
- User forbids creating .md files without explicit permission, requires clarification on ambiguous instructions, and demands confirmation for major plans.
