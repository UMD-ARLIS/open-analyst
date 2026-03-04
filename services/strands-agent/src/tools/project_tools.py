"""Project management tools for the Strands agent."""

from strands import tool

from util.capture import ProjectAPI


@tool
def collection_overview(
    collection_id: str = "",
    project_id: str = "",
    api_base_url: str = "http://localhost:5173",
) -> str:
    """Get an overview of project collections and their documents.

    Args:
        collection_id: Optional collection ID to focus on.
        project_id: The project ID.
        api_base_url: Base URL of the Node.js API.

    Returns:
        Formatted overview of collections and documents.
    """
    if not project_id:
        raise ValueError("project context is required")

    api = ProjectAPI(api_base_url, project_id)
    collections = api.list_collections()
    selected = None
    if collection_id:
        selected = next((c for c in collections if c.get("id") == collection_id), None)

    docs = api.list_documents(collection_id)
    top_docs = docs[:20]

    lines = []
    lines.append(f"Project collections: {len(collections)}")
    if selected:
        lines.append(f"Target collection: {selected.get('name', '')} ({selected.get('id', '')})")
    elif collection_id:
        lines.append(f"Target collection: {collection_id}")
    else:
        lines.append("Target collection: All Collections")
    lines.append(f"Document count: {len(docs)}")
    lines.append("")
    lines.append("Documents:")

    for doc in top_docs:
        snippet = str(doc.get("content", "")).replace("\n", " ").replace("\r", "")[:220]
        title = doc.get("title", "Untitled")
        source = doc.get("sourceUri") or doc.get("sourceType", "local source")
        lines.append(f"- {title} | {source}")
        if snippet:
            lines.append(f"  snippet: {snippet}" + ("..." if len(snippet) >= 220 else ""))

    if len(docs) > len(top_docs):
        lines.append(f"...and {len(docs) - len(top_docs)} more documents.")

    return "\n".join(lines)
