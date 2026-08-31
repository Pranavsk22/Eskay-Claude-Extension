# Eskay — Memory Architecture & Retrieval Engine

Eskay implements an on-device, vector-backed episodic memory layer that enables persistent context retention (goals, architecture decisions, system constraints, next steps, and code artifacts) across independent sessions on Claude.ai without transmitting data to external servers.

---

## 1. Design Rationale: Episodic Retrieval vs. Context Summarization

Traditional LLM workflows rely on rolling context compression (summarizing transcripts) or manual log attachment. Eskay operates on an **episodic vector-retrieval paradigm**:

| Dimension | Retrieval-Based Memory (Eskay) | Context Compression / Summarization |
| :--- | :--- | :--- |
| **Information Loss** | **Zero** for indexed facts. Records are stored and injected verbatim. | **High**. Summaries discard exact config values, types, and code snippets. |
| **Context Consumption** | **Minimal**. Only the top-$k$ ($k=5$) most relevant chunks are injected. | **Linear Growth**. Rolling summaries consume increasing token budget. |
| **Cross-Session Recall** | **High**. Cosine similarity retrieves pertinent constraints regardless of session age. | **Low**. Early session decisions decay exponentially across chat threads. |
| **Compute Overhead** | Local client CPU vector dot-product ($<2\text{ms}$, 0 network calls). | Additional LLM inference calls consuming session quota and tokens. |
| **Privacy Guarantee** | 100% Client-Side. Persisted in local browser `IndexedDB`. | Requires sending prompt history to remote LLMs for summarization. |

---

## 2. Embedding Generation Strategy

To ensure zero external API dependencies, absolute privacy, and instant sub-millisecond execution without cold-start model downloads, Eskay implements a deterministic **384-dimensional polynomial feature-hashing algorithm** with $L_2$-normalization.

```
[Input Text] ──► Tokenize Word Tokens ──► Polynomial Rolling Hash (radix 31)
                                                       │
                                                       ▼
                                            Modulo Feature Index (0..383)
                                                       │
                                                       ▼
                                            Increment Coordinate in Vector
                                                       │
                                                       ▼
                                            Apply L2 Normalization ──► [384-d Embedding]
```

### Mathematical Formulation

Given input string $T$, it is normalized and parsed into lowercase word tokens $W = \{w_1, w_2, \dots, w_n\}$. A zero vector $\mathbf{v} \in \mathbb{R}^{384}$ is allocated.

For each word $w$, a 32-bit polynomial rolling hash is calculated:
$$\text{hash}(w) = \left( \sum_{i=0}^{L-1} \text{charCodeAt}(w_i) \cdot 31^{L-1-i} \right) \pmod{2^{32}}$$

The coordinate index is mapped via:
$$\text{index}(w) = |\text{hash}(w)| \pmod{384}$$
$$\mathbf{v}_{\text{index}(w)} \leftarrow \mathbf{v}_{\text{index}(w)} + 1$$

To ensure retrieval score invariance with respect to text length, the vector is $L_2$-normalized:
$$\mathbf{e} = \frac{\mathbf{v}}{\|\mathbf{v}\|_2 + \epsilon}, \quad \|\mathbf{v}\|_2 = \sqrt{\sum_{j=0}^{383} \mathbf{v}_j^2}$$

*(For testing and production, this delivers deterministic vector representations with zero external weight files).*

### Transformer Inference Roadmap (ONNX Web / MiniLM)

For advanced semantic transfer beyond lexical overlap, Eskay v2 includes an architectural roadmap for loading quantized `all-MiniLM-L6-v2` via `transformers.js` (`onnxruntime-web`). The current production engine utilizes the feature-hashing vector for guaranteed zero-download, instant startup, and battery-friendly operation.

---

## 3. Storage & Retrieval Lifecycle

### 3.1 IndexedDB Schema (`schema.js` & `vectorStore.js`)
All memory entities are indexed in IndexedDB (`EskayMemoryDB`, store `records`):
```json
{
  "id": "session-123-decision-1725123456-abc",
  "sessionId": "chat-uuid",
  "timestamp": 1725123456789,
  "type": "goal | decision | constraint | snippet | nextStep",
  "text": "Use PostgreSQL with Prisma ORM for relational storage.",
  "embedding": [0.042, -0.128, ...],
  "sourceMessageIndex": 3
}
```

### 3.2 Similarity Search & Prompt Preamble Injection
When `Recall Memory` is triggered in a new chat, Eskay:
1. Calculates the query embedding $\mathbf{q} \in \mathbb{R}^{384}$.
2. Scans stored records and computes the cosine dot product:
   $$\text{Similarity}(\mathbf{q}, \mathbf{d}) = \mathbf{q} \cdot \mathbf{d} = \sum_{j=0}^{383} \mathbf{q}_j \mathbf{d}_j$$
3. Filters candidates ($\text{similarity} > 0.10$), ranks in descending order, and extracts the top 5 records.
4. Prepends the structured memory block into the Claude input field:
```xml
<eskay-memory>
### Relevant Context from Past Sessions:
- **[GOAL]**: Implement client-side memory consolidation in Eskay.
- **[DECISION]**: IndexedDB backed vector storage with cosine similarity.
- **[CONSTRAINT]**: All memory operations must run 100% in-browser.
</eskay-memory>
```

---

## 4. Automated Memory Consolidation (`consolidate.js`)

To prevent unbounded vector database growth and remove stale or superseded constraints:
1. **Trigger Points**: Executed automatically post-export in `exportContext()` and available manually via the `Consolidate` toolbar button.
2. **Near-Duplicate Detection**: Evaluates pairwise cosine similarity for records within the same category type (`goal`, `decision`, `constraint`, `nextStep`).
3. **Pruning Strategy**: When $\text{Similarity}(R_a, R_b) > 0.85$:
   - The newer record (higher timestamp) is preserved.
   - The older superseded record is deleted from IndexedDB.
4. **Validation**: Regression-tested via `test/consolidation-test-runner.js` and the LongMemEval harness (`recall_eval.js`).
