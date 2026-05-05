# Repository-Based Authorization (Cookie-Based Access Control)

## Overview

DeepV-Ki implements a simple yet effective repository-based authorization system for internal network scenarios. The system uses HTTP cookies to control access to Wiki pages and related endpoints.

## How It Works

### 1. User Login (SSO)
When a user logs in via SSO:
1. Backend validates the SSO token
2. Creates a session cookie (`deepwiki_session`)
3. **Fetches the user's GitLab project list** (all projects they have access to)
4. Creates a permission set from the project list
5. **Encodes the permission set as Base64** into a second cookie (`deepwiki_repo_permissions`)

### 2. Repository Permission Cookie

The `deepwiki_repo_permissions` cookie contains:
```json
{
  "user_id": "user@company.com",
  "repos": [
    {
      "owner": "team-a",
      "repo": "project-1",
      "repo_type": "gitlab",
      "access_level": "developer"
    },
    {
      "owner": "team-b",
      "repo": "project-2",
      "repo_type": "gitlab",
      "access_level": "maintainer"
    }
  ],
  "created_at": "2024-11-21T10:30:00",
  "version": 1
}
```

This is then Base64 encoded and stored in the cookie.

### 3. Access Control

When a user tries to access a Wiki page or endpoint that requires repository access:
1. Backend reads the `deepwiki_repo_permissions` cookie
2. Decodes the Base64 string
3. Checks if the requested repository (`owner/repo`) is in the user's permission list
4. **Returns 403 (Forbidden) if access is denied**
5. **Returns 401 (Unauthorized) if no permission cookie is found**

## Protected Endpoints

The following endpoints now require repository access verification:

### Wiki Generation & Management
- `POST /api/tasks/wiki/generate` - Create Wiki generation task
- `GET /api/wiki_cache` - Retrieve cached Wiki
- `POST /api/wiki_cache` - Save Wiki cache
- `DELETE /api/wiki_cache` - Delete Wiki cache

### Wiki Content & Structure
- `GET /api/wiki/projects/{project_key}/status` - Get project status
- `POST /api/wiki/projects/status/batch` - Batch status query
- `GET /api/wiki/projects/{project_key}/content` - Get Wiki content
- `GET /api/wiki/projects/{project_key}/structure` - Get Wiki structure
- `GET /api/wiki/projects/{project_key}/html/{page_id}` - Get page content

### Chat
- `POST /api/chat/completions/stream` - Chat endpoint (optional repo verification)

## Public Endpoints (No Auth Required)

These endpoints remain public:
- `GET /api/health` - Health check
- `GET /` - Root endpoint
- `GET /auth/login/redirect` - SSO login redirect
- `GET /auth/sso/callback` - SSO callback
- `GET /auth/sso/status` - Check auth status (doesn't require auth)
- `GET /gitlab/health` - GitLab health check

## Implementation Details

### Files Created
1. **`api/repo_permission_manager.py`** - Handles permission encoding/decoding
   - `RepoPermissionEncoder`: Base64 encode/decode
   - `RepoPermissionManager`: High-level permission management
   - `RepoPermission`: Single repository permission entry
   - `RepoPermissionSet`: Collection of permissions for a user

2. **`api/auth_dependencies.py`** - FastAPI dependency injectors
   - `verify_repo_access()` - Validate repository access
   - `verify_repo_access_with_session()` - Validate both session and repo access
   - `get_user_from_cookie()` - Extract user ID from permission cookie
   - `get_user_accessible_repos()` - Get all accessible repositories

### Files Modified
1. **`api/sso_routes.py`**
   - Modified `/auth/sso/callback` to generate permission cookie
   - Fetches GitLab projects after successful SSO login
   - Encodes permissions into Base64 cookie

2. **`api/routers/wiki.py`**
   - Added `verify_repo_access` dependency to:
     - `POST /api/tasks/wiki/generate`
     - `GET /api/wiki_cache`
     - `POST /api/wiki_cache`
     - `DELETE /api/wiki_cache`

3. **`api/wiki_api_routes.py`**
   - Added `verify_repo_access` dependency to:
     - `GET /api/wiki/projects/{project_key}/status`
     - `GET /api/wiki/projects/{project_key}/content`
     - `GET /api/wiki/projects/{project_key}/structure`
     - `GET /api/wiki/projects/{project_key}/html/{page_id}`
   - Added permission validation to batch status endpoint

4. **`api/routers/chat.py`**
   - Added optional repository verification
   - Validates access if `owner` and `repo` query parameters are provided

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "No repository permissions cookie found. Please log in first."
}
```

### 403 Forbidden
```json
{
  "detail": "You don't have access to repository owner/repo. Please check your permissions in GitLab."
}
```

## Frontend Integration

### 1. Automatic Cookie Handling
The browser automatically sends both cookies with requests:
- `deepwiki_session` - Session validation (HttpOnly)
- `deepwiki_repo_permissions` - Repository permissions (can be read by JS)

### 2. Optional: Display User's Accessible Repos
Frontend can:
1. Read the `deepwiki_repo_permissions` cookie
2. Base64 decode it
3. Display the list of accessible repositories to the user

### 3. Query Parameters
When accessing protected endpoints, ensure `owner` and `repo` query parameters are provided:

```javascript
// Example: Get Wiki cache
fetch('/api/wiki_cache?owner=team-a&repo=project-1', {
  credentials: 'include' // Important: send cookies
})
```

## Security Considerations

### Strengths
✅ **Simple and effective** for internal networks
✅ **No per-request overhead** - all permissions in one cookie
✅ **Stateless on backend** - no session storage needed
✅ **Easy to refresh** - logout and re-login to update permissions

### Limitations
⚠️ **Cookie-based** - vulnerable to XSS if not properly sanitized
⚠️ **Permission staleness** - permissions only updated on login
⚠️ **No real-time revocation** - if GitLab revokes access, user keeps access until re-login

### For Enhanced Security
1. Use `HttpOnly` flag for sensitive cookies (already done for `deepwiki_session`)
2. Keep the permission cookie readable for frontend (needed for UX)
3. Implement XSS protection (currently using `markdown-sanitizer.ts`)
4. Consider regular permission refresh (e.g., every 24 hours)
5. For production, enable `Secure` flag on cookies (requires HTTPS)

## Future Enhancements

1. **Permission Refresh Endpoint** - Allow users to refresh permissions without full login
2. **Real-time Access Control** - Query GitLab API per-request (slower but more secure)
3. **Role-Based Access Control** - Use different access levels (viewer, editor, admin)
4. **Audit Logging** - Log all access attempts and denials
5. **Rate Limiting** - Prevent abuse of protected endpoints

## Testing the Authorization

### 1. Login Flow
```bash
# Get SSO login URL
curl http://localhost:8001/auth/login/redirect

# Follow the redirect, which calls /auth/sso/callback with SID
# This sets both cookies
```

### 2. Verify Cookie
```bash
# Check cookies after login
curl -b cookies.txt http://localhost:8001/auth/sso/status

# Cookies should be saved in cookies.txt
```

### 3. Access Protected Endpoint
```bash
# With valid permission
curl -b cookies.txt http://localhost:8001/api/wiki_cache?owner=team-a&repo=project-1

# Without permission cookie
curl http://localhost:8001/api/wiki_cache?owner=team-a&repo=project-1
# Returns: 401 Unauthorized
```

### 4. Test Forbidden Access
```bash
# Try to access a repo you don't have access to
# (modify the cookie manually to remove a repository)
curl -b cookies.txt http://localhost:8001/api/wiki_cache?owner=other-team&repo=private-repo
# Returns: 403 Forbidden
```
