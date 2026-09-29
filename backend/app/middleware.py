import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi import Request


class SimpleRateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int = 60, window_seconds: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients = {}

    async def dispatch(self, request: Request, call_next):
        # CORS preflights should never count against the limit
        if request.method == "OPTIONS":
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.time()
        calls = [ts for ts in self.clients.get(client, []) if ts > now - self.window_seconds]
        if len(calls) >= self.max_requests:
            # Raising HTTPException inside BaseHTTPMiddleware surfaces as a 500, so respond directly
            retry_after = max(1, int(self.window_seconds - (now - calls[0])))
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"},
                headers={"Retry-After": str(retry_after)},
            )
        calls.append(now)
        self.clients[client] = calls
        return await call_next(request)
