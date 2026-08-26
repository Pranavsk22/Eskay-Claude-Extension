# Eskay — Memory Architecture

Eskay uses a client-side, vector-backed persistent memory layer that lets you retain key context, decisions, constraints, next steps, and code snippets across different sessions on Claude.ai.

## Design Rationale: Memory as a Dynamic Knowledge System

Traditional approaches to keeping context across LLM chats rely heavily on **context compression** (summarizing transcripts) or uploading raw chat logs. Eskay employs a **retrieval-based memory paradigm** utilizing client-side embeddings and vector similarity.

### Contrast: Retrieval vs. Compression

| Dimension | Retrieval-Based Memory (Eskay) | Pure Context Compression (Summarization) |
|---|---|---|
| **Information Loss** | **None** for selected facts. The exact text is stored and returned verbatim. | **High**. Summaries discard specific code blocks, exact constraint details, or config parameters. |
| **Context Window Consumption** | **Extremely Low**. Only the top-$k$ most relevant memory records are injected. | **Moderate-to-High**. A rolling summary grows linearly or leaves out crucial details. |
| **Cross-Session Recall** | **High**. Similarity search recalls relevant details regardless of chronological sequence. | **Low**. Summarizing makes past sessions decay exponentially in detail. |
| **Computation Source** | Client-side CPU/GPU vector calculation (using `all-MiniLM-L6-v2`). | Calls to an LLM to generate summaries, consuming additional tokens. |

### Technical Trade-offs

1. **Indexing & Query Quality Dependency:** The system's effectiveness depends on the quality of the client-side embeddings (`all-MiniLM-L6-v2`) and the query text. If the user's new prompt uses completely different terminology, retrieval similarity scores may decrease. We mitigate this by keeping similarity thresholds low (0.1) and indexing clean structured categories (goals, constraints, decisions).
2. **Offline Local Privacy vs. Cold Start:** Running entirely locally preserves 100% data privacy. However, it requires a "cold start" model download (~23MB) on first run, which is cached in the browser for future offline use.
3. **Lightweight Consolidation:** Instead of let memory grow unbounded (causing slower vector scans), a manual or periodic pruning routine runs cosine similarity checks between records. Any near-duplicates (similarity > 0.85) are merged, keeping only the newest timestamp, preventing memory bloating.
