"""
Integration tests for Authentication Flow (JWT & SSO)
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from api.main import app
from api.auth_utils import create_access_token, decode_access_token
from api.user_manager import user_manager

client = TestClient(app)

@pytest.fixture
def mock_sso_client():
    with patch("api.sso_routes.oauth.oa_sso") as mock:
        yield mock

def test_jwt_generation_and_validation():
    """Test JWT token creation and decoding"""
    data = {"uid": "test@example.com", "username": "testuser"}
    token = create_access_token(data)
    assert token is not None

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["uid"] == "test@example.com"
    assert payload["username"] == "testuser"

def test_protected_endpoint_with_jwt():
    """Test accessing a protected endpoint with a valid JWT"""
    # 1. Create a token
    user_data = {
        "uid": "integration_test@example.com",
        "username": "integration_test",
        "sub": "test_session_id"
    }
    token = create_access_token(user_data)

    # 2. Ensure session does NOT exist locally (to test restoration)
    # We use a random session ID to ensure it's new
    import uuid
    session_id = str(uuid.uuid4())
    user_data["sub"] = session_id
    token = create_access_token(user_data)

    # 3. Request with Token
    response = client.get(
        "/api/auth/sso/user",
        headers={"Authorization": f"Bearer {token}"}
    )

    # 4. Verify response
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["user_info"]["uid"] == "integration_test@example.com"

    # 5. Verify session was restored locally
    session = user_manager.get_session(session_id)
    assert session is not None
    assert session.user_info.uid == "integration_test@example.com"

def test_protected_endpoint_without_token():
    """Test accessing a protected endpoint without a token"""
    response = client.get("/api/auth/sso/user")
    # The endpoint returns 200 with valid=False for frontend check,
    # but let's check the response content
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False

def test_protected_endpoint_with_invalid_token():
    """Test accessing a protected endpoint with an invalid token"""
    response = client.get(
        "/api/auth/sso/user",
        headers={"Authorization": "Bearer invalid_token"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False

def test_sso_callback_flow(mock_sso_client):
    """Test the SSO callback flow (mocked)"""
    # Mock the SSO token response
    mock_sso_client.authorize_access_token.return_value = {
        "userinfo": {
            "email": "sso_user@example.com",
            "preferred_username": "sso_user",
            "sub": "12345"
        },
        "id_token": "mock_id_token"
    }

    # Simulate callback request
    response = client.get("/api/auth/sso/callback?code=mock_code&state=mock_state")

    # Should redirect to frontend with token
    assert response.status_code == 302
    location = response.headers["location"]
    assert "token=" in location
    assert "/auth/callback" in location
