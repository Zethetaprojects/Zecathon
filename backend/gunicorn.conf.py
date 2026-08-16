"""Gunicorn production configuration for ZECATHON backend.

Used by the VM deployment (docker-compose.vm.yml / deploy-vm.sh).
Uvicorn async workers give FastAPI the concurrency it needs while gunicorn
handles process management.
"""

import multiprocessing

bind = "0.0.0.0:8000"
worker_class = "uvicorn.workers.UvicornWorker"

# workers = (2 × CPU cores) + 1, capped at 4 for a modest VM
workers = min(multiprocessing.cpu_count() * 2 + 1, 4)

# Threads are not used with async workers, but keep sensible defaults
threads = 1
worker_connections = 1000

# Timeouts: evaluations can take a while
timeout = 120
keepalive = 5
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Reduce memory churn on reload
preload_app = False

# Capture output from the workers for systemd journal
capture_output = True
enable_stdio_inheritance = True
