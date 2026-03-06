import uuid
from datetime import timedelta

from app.services.auth import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_and_verify():
    password = "testpassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert "exp" in payload


def test_decode_access_token_expired():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, expires_delta=timedelta(seconds=-1))
    payload = decode_access_token(token)
    assert payload is None


def test_hash_refresh_token():
    token = "some-random-token-string"
    hashed = hash_refresh_token(token)
    assert hashed != token
    assert hash_refresh_token(token) == hashed
