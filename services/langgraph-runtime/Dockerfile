FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir uv \
  && useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY pyproject.toml langgraph.json ./
RUN uv sync --no-dev --no-install-project

COPY src ./src
RUN uv sync --no-dev

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8081

CMD ["python", "src/main.py"]
