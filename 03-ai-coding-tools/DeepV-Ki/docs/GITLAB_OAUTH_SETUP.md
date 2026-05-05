# GitLab OAuth Application Configuration Guide

This document provides a step-by-step guide on how to create and configure a GitLab OAuth Application for DeepV-Ki. Correct configuration is critical for resolving errors like "The redirect URI included is not valid" or "The requested scope is invalid".

## 1. Create a New Application

You can create an application either under your user settings (for personal use) or in the Admin Area (for instance-wide use).

### User Settings (Recommended for testing)
1.  Log in to GitLab.
2.  Click your avatar in the top-right corner and select **Edit profile** (or **Settings**).
3.  In the left sidebar, select **Applications**.
4.  Click **Add new application**.

### Group Settings (For organization use)
1.  Go to your Group page.
2.  Select **Settings** > **Applications** from the left sidebar.
3.  Click **Add new application**.

## 2. Configure Application Details

Fill in the form with the following details:

*   **Name**: `DeepV-Ki` (or any name you prefer).
*   **Redirect URI**: This **MUST** match exactly what your DeepV-Ki backend expects.
    *   **Local Development**:
        ```text
        http://localhost:8001/api/auth/gitlab/callback
        ```
    *   **Production**:
        ```text
        https://your-domain.com/api/auth/gitlab/callback
        ```
    *   *Note: If you use `127.0.0.1` in your browser/env, you must use `127.0.0.1` here. Do not mix `localhost` and `127.0.0.1`.*

*   **Confidential**: Ensure this is **checked** (default).
*   **Expire access tokens**: Optional, leaving it unchecked is easier for development.

## 3. Select Scopes (Critical!)

You must check the boxes for the following scopes. If any are missing, the login will fail with an "invalid scope" error.

*   ✅ **api** (Grants complete read/write access to the API, required for reading code repositories)
*   ✅ **read_user** (Grants read-only access to the authenticated user's profile)

> **Why `api` scope?**
> DeepV-Ki needs to read repository structures, file content, and branches to generate Wikis. The `read_repository` scope is sometimes insufficient for certain API endpoints, so `api` is recommended for full compatibility.

## 4. Save and Configure Environment

1.  Click **Save application**.
2.  You will see an **Application ID** and a **Secret**.
3.  Copy these values to your DeepV-Ki `.env` file:

```bash
GITLAB_CLIENT_ID=your_application_id
GITLAB_CLIENT_SECRET=your_application_secret
GITLAB_REDIRECT_URI=http://localhost:8001/api/auth/gitlab/callback  # Must match exactly what you entered in step 2
```

## 5. Troubleshooting

### Error: "The redirect URI included is not valid"
*   **Cause**: The `redirect_uri` sent by DeepV-Ki does not match the one configured in GitLab.
*   **Fix**:
    1.  Check your `.env` file's `GITLAB_REDIRECT_URI`.
    2.  Check the GitLab Application settings.
    3.  Ensure protocol (`http` vs `https`), host, port, and path match **character for character**. Trailing slashes matter!

### Error: "The requested scope is invalid, unknown, or malformed"
*   **Cause**: DeepV-Ki is requesting a scope (e.g., `api`) that you did not check in the GitLab Application settings.
*   **Fix**: Edit the GitLab Application and ensure all scopes listed in Step 3 are checked.

### Error: "403 Forbidden" after login
*   **Cause**: The user might not have permission to access the repository you are trying to analyze.
*   **Fix**: Ensure the GitLab user you logged in with has at least "Reporter" access to the target repository.
