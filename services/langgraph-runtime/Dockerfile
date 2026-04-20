FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV SKILLS_DIR=/app/skills

RUN pip install --no-cache-dir uv \
  && useradd --create-home --uid 10001 appuser

WORKDIR /app

COPY services/langgraph-runtime/pyproject.toml ./pyproject.toml
COPY services/langgraph-runtime/langgraph.json ./langgraph.json
RUN uv sync --no-dev --no-install-project

COPY services/langgraph-runtime/src ./src
COPY skills ./skills
RUN uv sync --no-dev

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8081

CMD ["python", "src/main.py"]
