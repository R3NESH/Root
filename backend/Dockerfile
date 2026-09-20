# The solver, as a container. Built for a small hosted instance, not a workstation.
#
# Python 3.12 rather than the 3.14 the local .venv uses: every dependency here publishes 3.12
# wheels, so the image builds from wheels alone and needs no compiler in it.

FROM python:3.12-slim

# Bytecode on import costs startup time on a cold instance; unbuffered output means logs appear
# in the host's log view as they happen rather than when the buffer fills.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Requirements first, so a code change does not re-download OR-Tools on every build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The plan solver is CPU-bound and holds no state between requests, so one uvicorn worker per
# instance is right: a second worker would double the memory for the same single core, and
# CP-SAT already parallelises inside the request. Scale by adding instances, not workers.
#
# $PORT is supplied by the host. The fallback is only for running the image locally.
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
