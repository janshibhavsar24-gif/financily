# api package — thin FastAPI routers.
# No business logic here. All computation is delegated to engine/ modules.
# All CPU-bound engine calls are wrapped in asyncio.to_thread.
