"""Verify Google Sign-In ID tokens ourselves (no Google SDK): check the RS256 signature against
Google's published keys, plus audience, issuer, expiry and that Google verified the email."""
import json
import time
import urllib.request

from jose import jwt

from ..config import settings

GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

_keys_cache: dict = {"keys": None, "fetched_at": 0.0}


class GoogleTokenError(ValueError):
    pass


def google_enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID)


def _google_keys(force: bool = False) -> list[dict]:
    # Google rotates keys roughly daily; refresh hourly or when a token names an unknown key
    if force or not _keys_cache["keys"] or time.time() - _keys_cache["fetched_at"] > 3600:
        with urllib.request.urlopen(GOOGLE_CERTS_URL, timeout=10) as response:
            _keys_cache["keys"] = json.load(response)["keys"]
            _keys_cache["fetched_at"] = time.time()
    return _keys_cache["keys"]


def verify_google_credential(credential: str) -> dict:
    """Return {email, name, sub} for a valid token, else raise GoogleTokenError."""
    if not google_enabled():
        raise GoogleTokenError("Google sign-in is not configured")
    try:
        kid = jwt.get_unverified_header(credential).get("kid")
    except Exception as exc:
        raise GoogleTokenError("Malformed Google credential") from exc

    key = next((k for k in _google_keys() if k.get("kid") == kid), None)
    if key is None:
        key = next((k for k in _google_keys(force=True) if k.get("kid") == kid), None)
    if key is None:
        raise GoogleTokenError("Unknown Google signing key")

    try:
        claims = jwt.decode(
            credential,
            key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            options={"verify_at_hash": False},
        )
    except Exception as exc:
        raise GoogleTokenError("Invalid Google credential") from exc

    if claims.get("iss") not in GOOGLE_ISSUERS:
        raise GoogleTokenError("Wrong token issuer")
    if not claims.get("email") or claims.get("email_verified") not in (True, "true"):
        raise GoogleTokenError("Google account email is not verified")
    return {"email": claims["email"].lower(), "name": claims.get("name") or claims["email"].split("@")[0], "sub": claims["sub"]}
