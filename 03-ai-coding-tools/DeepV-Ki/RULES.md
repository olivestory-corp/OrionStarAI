# ⚡ DEEPWIKI DEV RULES & ARCHITECTURE ⚡

**MAINTAINER:** Kong Haifeng | **UPDATED:** 2025-11-22

## 🚨 CORE MANDATES (NON-NEGOTIABLE)

1.  **🚫 NO UNTESTED COMMITS:**
    *   **MUST** pass `npx tsc --noEmit` & `npm run lint`.
    *   **MUST** verify key features (Home, Ask, Wiki) in **BROWSER**.
2.  **📖 READ BEFORE EDITING:** Strict adherence to Routing/API specs below.
3.  **⚛️ ATOMIC COMMITS:** One type of change per commit. No mixing.

---

## 🐍 BACKEND ROUTING (FastAPI)

**RULE:** ALL `APIRouter` instances **MUST** use `prefix="/api"`.

### ✅ CORRECT
```python
router = APIRouter(prefix="/api", tags=["Chat"])
@router.post("/chat/stream")
# Result: POST /api/chat/stream
```

### ❌ FORBIDDEN
*   `prefix=""` (Creates duplicate `/api` if decorator adds it)
*   `prefix="/chat"` (Creates `/chat/...` missing `/api` prefix)

**CURRENT ROUTERS:**
*   `/api`: `health`, `config`, `wiki`, `chat`
*   *(Legacy/No Prefix)*: `gitlab`, `sso`, `wiki_api` (Require Frontend Proxy)

---

## ⚛️ FRONTEND API CALLS (Next.js)

**RULE:** Frontend **ALWAYS** calls `/api/...`.

### 1. Next.js Proxy (RECOMMENDED)
Create `src/app/api/[path]/route.ts`:
```typescript
const BACKEND = process.env.PYTHON_BACKEND_HOST || 'http://localhost:8001';
export async function POST(req) {
  // Proxy to ${BACKEND}/api/[path]
}
```

### 2. Direct Fetch
```typescript
// Only if Next.js rewrites are configured
fetch('/api/models/config')
```

**⚠️ COMMON PITFALLS:**
*   **Frontend 404 / Backend 200:** Missing Next.js Proxy route.
*   **Prod Failures:** Hardcoded `localhost`. **ALWAYS** use env vars.

---

## ✅ VERIFICATION CHECKLIST

**BEFORE COMMIT:**
1.  [ ] **Type Check:** `npx tsc --noEmit`
2.  [ ] **Lint:** `npm run lint`
3.  [ ] **Route Check:** `curl http://localhost:8001/api/...`
4.  [ ] **UI Check:** Verify Project List, Chat, & Wiki Gen in browser.