import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, HTTPException


class SimpleRateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients = {}

    async def dispatch(self, request: Request, call_next):
        client = request.client.host if request.client else "unknown"
        now = time.time()
        window = self.window_seconds
        calls = self.clients.get(client, [])
        # remove old
        calls = [ts for ts in calls if ts > now - window]
        if len(calls) >= self.max_requests:
            raise HTTPException(status_code=429, detail="Too many requests")
        calls.append(now)
        self.clients[client] = calls
        response = await call_next(request)
        return response
