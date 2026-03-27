import json
import os
import glob
import hashlib
import re
from pathlib import Path
from django.conf import settings

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    ST_AVAILABLE = True
except ImportError:
    ST_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    import pypdf
    PYPDF_AVAILABLE = True
except ImportError:
    try:
        import PyPDF2
        PYPDF_AVAILABLE = True
        pypdf = PyPDF2
    except ImportError:
        PYPDF_AVAILABLE = False


KB_DIR = Path(settings.BASE_DIR) / 'rag' / 'knowledge_base'

DEFAULT_LOCAL_MODEL_ID = 'Qwen/Qwen2.5-0.5B-Instruct'
INDEX_SCHEMA_VERSION = 'v2-lang-split'

SYSTEM_PROMPT = """You are a medical AI assistant for pathologists and oncologists.

RULES:
1. Answer ONLY based on the provided knowledge base context
2. If information is not in the context, say clearly: "This information is not in the knowledge base"
3. Cite source numbers in square brackets [1], [2]
4. Use proper medical terminology
5. Do not make diagnoses — provide reference information only
6. Always add: "This information is for research purposes only"
7. If user language is Russian, translate medical terms to Russian and explain briefly in simpler wording unless user explicitly asks for strict terminology.

Respond in the same language as the question (Russian or English).

DISCLAIMER: For research and demonstration purposes only. Not for clinical use."""

ASSISTANT_PROMPT = """You are BioVision Copilot, a concise and helpful AI assistant for a pathology workflow.

GOALS:
1. Help with practical next steps, workflow organization, and interpretation guidance.
2. Be clear about limitations. Do not provide definitive diagnosis.
3. If asked outside available data, offer a safe, useful alternative.
4. Keep responses short, structured, and actionable.

STYLE:
- Friendly but professional.
- 3-8 lines when possible.
- Use user language only.

DISCLAIMER: For research purposes only. Not for clinical use."""

CLASS_DESCRIPTION_PROMPT = """You are a medical AI assistant generating structured clinical summaries for pathologists.

For the given tissue class, provide a structured response in this EXACT format (use the user-selected language only):

**Detected / Обнаружены:** [brief tissue description]
**Morphology / Морфология:** [key morphological features in 1-2 sentences]
**Clinical significance / Клиническое значение:** [clinical importance in 1 sentence]
**Recommendations / Рекомендации:** [protocol recommendation — cite NCCN/WHO/AJCC if in context]

[Source / Источник: cite relevant source from context]

---
*For research purposes only. Not for clinical use.*

Base your answer ONLY on the provided knowledge base context. Be concise and precise."""


def _normalize_language(language: str | None) -> str:
    lang = (language or '').strip().lower()
    if lang.startswith('en'):
        return 'en'
    return 'ru'


def _language_instruction(language: str) -> str:
    return (
        "Respond in English only. Never include Russian words, phrases, or transliterations."
        if language == 'en'
        else "Отвечай только на русском языке. Не используй английские слова или фразы."
    )


def _looks_like_history_critical_query(question: str) -> bool:
    q = (question or '').lower()
    triggers = [
        'critical', 'urgent', 'emergency', 'patient', 'history',
        'критич', 'сроч', 'пациент', 'истори', 'неотлож',
    ]
    return any(t in q for t in triggers)


def _looks_like_greeting(question: str) -> bool:
    q = (question or '').strip().lower()
    q = re.sub(r'[^\wа-яё\s!?]', ' ', q, flags=re.IGNORECASE)
    q = re.sub(r'\s+', ' ', q).strip()
    if not q:
        return False
    greetings = {
        'hi', 'hello', 'hey', 'yo', 'sup', 'how are you',
        'привет', 'здравствуйте', 'здравствуй', 'хай', 'салам', 'как дела',
    }
    return q in greetings


def _no_data_message(language: str) -> str:
    if language == 'en':
        return (
            'No reliable information was found in the knowledge base for this question. '
            'Try rephrasing the query or specifying a concrete pathology class.'
        )
    return (
        'По этому вопросу в базе знаний не найдено надежных данных. '
        'Попробуйте переформулировать запрос или указать конкретный патологический класс.'
    )


def _greeting_message(language: str) -> str:
    if language == 'en':
        return 'Hello. I am ready to help with pathology questions. Tell me what case or class you want to review.'
    return 'Здравствуйте. Готов помочь с вопросами по патоморфологии. Уточните, какой случай или класс ткани разобрать.'


def _assistant_fallback(question: str, language: str = 'ru') -> str:
    q = (question or '').strip().lower()
    if _looks_like_greeting(question):
        if language == 'en':
            return (
                "Hello. I am BioVision Copilot (Jarvis-lite mode).\n"
                "I can help with: case workflow, question framing for RAG, report checklist, and explanation of model outputs."
            )
        return (
            "Здравствуйте. Я BioVision Copilot (режим Jarvis-lite).\n"
            "Могу помочь с: workflow по кейсу, формулировкой вопроса для RAG, чеклистом отчета и пояснением метрик модели."
        )

    if any(x in q for x in ['погод', 'weather', 'курс валют', 'bitcoin', 'марс']):
        if language == 'en':
            return "I do not have live internet data in this mode. I can still help with pathology workflow and report QA."
        return "В этом режиме у меня нет доступа к live-интернет данным. Зато могу помочь с патоморфологическим workflow и QA отчета."

    if language == 'en':
        return (
            "Jarvis-lite quick help:\n"
            "1) Clarify your goal (diagnostic clue, report text, or triage priority).\n"
            "2) If needed, switch to RAG Search mode for evidence-backed references.\n"
            "3) I can draft a concise checklist for the current case."
        )

    return (
        "Быстрая помощь Jarvis-lite:\n"
        "1) Уточните цель: диагностический признак, текст отчета или приоритизация кейса.\n"
        "2) При необходимости переключитесь в режим RAG Search для ответов с базой знаний.\n"
        "3) Я могу составить короткий чеклист по текущему случаю."
    )


def _compute_kb_hash() -> str:
    """Hash of all knowledge base files to detect changes."""
    h = hashlib.md5()
    h.update(INDEX_SCHEMA_VERSION.encode())
    for path in sorted(KB_DIR.glob('*')):
        if path.suffix in ('.json', '.txt', '.pdf') and path.is_file():
            h.update(path.name.encode())
            h.update(str(path.stat().st_mtime).encode())
    return h.hexdigest()


def _read_pdf(path: Path) -> str:
    if not PYPDF_AVAILABLE:
        return ''
    try:
        text_parts = []
        with open(path, 'rb') as f:
            reader = pypdf.PdfReader(f)
            for page in reader.pages:
                text_parts.append(page.extract_text() or '')
        return '\n'.join(text_parts)
    except Exception as e:
        print(f"[RAG] PDF read error {path.name}: {e}")
        return ''


def _load_knowledge_base() -> list[dict]:
    """Load all documents from JSON, TXT, and PDF files in knowledge_base/."""
    if not KB_DIR.exists():
        print(f"[RAG] knowledge_base dir not found: {KB_DIR}")
        return []

    docs = []

    # 1. JSON — pathology class descriptions
    for json_path in KB_DIR.glob('*.json'):
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for item in data.get('classes', []):
                cid = item['id']
                text_en = (
                    f"Class {item['name']}: {item['description']} "
                    f"Clinical significance: {item['clinical_significance']} "
                    f"Recommendations: {item['recommendations']}"
                )
                text_ru = (
                    f"Класс {item.get('name_ru', item['name'])}: {item.get('description_ru', item['description'])} "
                    f"Клиническое значение: {item.get('clinical_significance_ru', item['clinical_significance'])} "
                    f"Рекомендации: {item.get('recommendations_ru', item['recommendations'])}"
                )
                refs = '; '.join(item.get('references', []))
                docs.append({
                    'id': f"class_{cid}_en",
                    'text': text_en,
                    'meta': {
                        'source': json_path.name,
                        'type': 'class_description',
                        'language': 'en',
                        'class_id': cid,
                        'class_name': item['name'],
                        'references': refs,
                    }
                })
                docs.append({
                    'id': f"class_{cid}_ru",
                    'text': text_ru,
                    'meta': {
                        'source': json_path.name,
                        'type': 'class_description',
                        'language': 'ru',
                        'class_id': cid,
                        'class_name': item['name'],
                        'references': refs,
                    }
                })
            print(f"[RAG] Loaded {len(data.get('classes', []))} classes from {json_path.name}")
        except Exception as e:
            print(f"[RAG] JSON error {json_path.name}: {e}")

    # 2. TXT — articles, guidelines, protocols
    for txt_path in KB_DIR.glob('*.txt'):
        try:
            with open(txt_path, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            if not content:
                continue
            # Chunk by paragraphs if long (> 1000 chars)
            if len(content) > 2000:
                chunks = _chunk_text(content, chunk_size=800, overlap=100)
                for i, chunk in enumerate(chunks):
                    docs.append({
                        'id': f"txt_{txt_path.stem}_{i}",
                        'text': chunk,
                        'meta': {
                            'source': txt_path.name,
                            'type': 'article',
                            'language': 'multi',
                            'chunk': i,
                        }
                    })
                print(f"[RAG] Loaded {len(chunks)} chunks from {txt_path.name}")
            else:
                docs.append({
                    'id': f"txt_{txt_path.stem}",
                    'text': content,
                    'meta': {'source': txt_path.name, 'type': 'article', 'language': 'multi'}
                })
                print(f"[RAG] Loaded {txt_path.name}")
        except Exception as e:
            print(f"[RAG] TXT error {txt_path.name}: {e}")

    # 3. PDF — scientific papers, protocols
    for pdf_path in KB_DIR.glob('*.pdf'):
        try:
            content = _read_pdf(pdf_path)
            if not content.strip():
                continue
            chunks = _chunk_text(content, chunk_size=800, overlap=100)
            for i, chunk in enumerate(chunks):
                docs.append({
                    'id': f"pdf_{pdf_path.stem}_{i}",
                    'text': chunk,
                    'meta': {
                        'source': pdf_path.name,
                        'type': 'pdf_article',
                        'language': 'multi',
                        'chunk': i,
                    }
                })
            print(f"[RAG] Loaded {len(chunks)} chunks from {pdf_path.name}")
        except Exception as e:
            print(f"[RAG] PDF error {pdf_path.name}: {e}")

    return docs


def _format_fallback(question: str, chunks: list[str], sources: list[dict], language: str = 'ru') -> str:
    """
    Build a structured answer from retrieved chunks without an LLM.
    Different questions get different answers because retrieval returns different chunks.
    """
    q_lower = question.lower()
    # Extract meaningful keywords (skip stopwords)
    stopwords = {'what', 'is', 'the', 'are', 'how', 'does', 'why', 'when', 'who',
                 'that', 'this', 'with', 'for', 'and', 'or', 'not', 'can', 'will',
                 'about', 'which', 'from', 'have', 'has', 'been', 'were', 'was',
                 'что', 'это', 'как', 'где', 'когда', 'почему', 'такое', 'является',
                 'при', 'для', 'чем', 'или', 'также', 'какие', 'какой', 'какая'}
    keywords = [w for w in q_lower.split() if len(w) > 3 and w not in stopwords]

    sections = []
    seen_sentences = set()

    for chunk, src in zip(chunks[:4], sources[:4]):
        src_label = (
            src.get('source', 'knowledge_base')
            .replace('.json', '').replace('.txt', '').replace('_', ' ').title()
        )
        class_name = src.get('class_name', '')

        # Split on both '.' and '\n'
        raw_sentences = []
        for part in chunk.replace('\n', '. ').split('.'):
            part = part.strip()
            if len(part) > 25:
                raw_sentences.append(part)

        # Score each sentence by keyword overlap
        scored = []
        for s in raw_sentences:
            score = sum(1 for kw in keywords if kw in s.lower())
            scored.append((score, s))
        scored.sort(reverse=True, key=lambda x: x[0])

        # Take top-3 unique sentences
        picked = []
        for _, s in scored[:6]:
            if s not in seen_sentences and len(picked) < 3:
                seen_sentences.add(s)
                picked.append(s)

        if not picked:
            # fallback: take first 2 sentences if no keyword match
            for _, s in scored[:2]:
                if s not in seen_sentences:
                    seen_sentences.add(s)
                    picked.append(s)

        if picked:
            header = class_name if class_name else src_label
            body = '\n'.join(f"- {s}." for s in picked)
            sections.append(f"{header}\n{body}\n[Source: {src_label}]")

    if not sections:
        if language == 'en':
            return (
                "No specific information found in the knowledge base for this query.\n"
                "Try rephrasing or asking about a specific class name.\n\n"
                "For research and demonstration purposes only."
            )
        return (
            "В базе знаний не найдено специфической информации по этому запросу.\n"
            "Попробуйте переформулировать вопрос или указать конкретный класс.\n\n"
            "Только для исследовательских и демонстрационных целей."
        )

    answer = '\n\n'.join(sections)
    answer += (
        "\n\nFor research and demonstration purposes only. Not for clinical use."
        if language == 'en'
        else "\n\nТолько для исследовательских и демонстрационных целей. Не для клинического применения."
    )
    return answer


def _format_class_description_fallback(question: str, chunks: list[str], sources: list[dict], language: str = 'ru') -> str:
    """
    Structured clinical description fallback (no LLM).
    Extracts morphology, clinical significance, and recommendations from context.
    """
    morph_kw = ['morpholog', 'cells', 'glands', 'structure', 'pattern', 'tissue',
                'морфол', 'клетк', 'железист', 'структур', 'ткань', 'ткани']
    clinical_kw = ['clinical', 'significance', 'malign', 'benign', 'cancer', 'tumor',
                   'клинич', 'значени', 'злокач', 'доброкач', 'рак', 'опухол']
    rec_kw = ['recommend', 'protocol', 'NCCN', 'WHO', 'AJCC', 'treatment', 'staging',
              'рекоменд', 'протокол', 'лечени', 'стадир']

    def extract_best(keywords, max_sent=2):
        found = []
        seen = set()
        for chunk in chunks[:4]:
            for s in chunk.replace('\n', '. ').split('.'):
                s = s.strip()
                if len(s) < 20 or s in seen:
                    continue
                score = sum(1 for kw in keywords if kw.lower() in s.lower())
                if score > 0:
                    seen.add(s)
                    found.append((score, s))
        found.sort(reverse=True)
        return ' '.join(s for _, s in found[:max_sent]) or '—'

    source_labels = list(dict.fromkeys(
        s.get('source', '').replace('.json', '').replace('.txt', '').replace('_', ' ').title()
        for s in sources[:3]
        if s.get('source')
    ))
    source_str = ', '.join(source_labels) if source_labels else 'Knowledge Base'

    morphology = extract_best(morph_kw, 2)
    clinical = extract_best(clinical_kw, 1)
    recommendations = extract_best(rec_kw, 2)

    # Try to get class name from sources
    cls_name = ''
    for s in sources:
        if s.get('class_name'):
            cls_name = s['class_name']
            break

    if language == 'en':
        detected_line = f"features of tissue class {cls_name}" if cls_name else "histology slide analysis results"
        return (
            f"Detected: {detected_line}\n"
            f"Morphology: {morphology}\n"
            f"Clinical significance: {clinical}\n"
            f"Recommendations: {recommendations}\n\n"
            f"Source: {source_str}\n\n"
            f"For research and demonstration purposes only. Not for clinical use."
        )

    detected_line = f"признаки ткани класса {cls_name}" if cls_name else "результаты анализа гистологического среза"
    return (
        f"Обнаружены: {detected_line}\n"
        f"Морфология: {morphology}\n"
        f"Клиническое значение: {clinical}\n"
        f"Рекомендации: {recommendations}\n\n"
        f"Источник: {source_str}\n\n"
        f"Только для исследовательских и демонстрационных целей. Не для клинического применения."
    )


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks by words."""
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = ' '.join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


class RAGEngine:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.embedder = None
        self.collection = None
        self.llm = None
        self.tokenizer = None
        self.llm_provider = 'fallback'
        self.ollama_base_url = ''
        self.ollama_model = ''
        self.ollama_api_key = ''
        self._init_embedder()
        self._init_chroma()
        self._init_llm()

    def _init_embedder(self):
        if not ST_AVAILABLE:
            print("[RAG] sentence-transformers not installed — using keyword search")
            return
        try:
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
            print("[RAG] Embedder loaded")
        except Exception as e:
            print(f"[RAG] Embedder error: {e}")

    def _init_chroma(self):
        if not CHROMA_AVAILABLE:
            print("[RAG] chromadb not installed — using fallback search")
            self._fallback_docs = _load_knowledge_base()
            return
        try:
            chroma_path = str(Path(settings.BASE_DIR) / 'chroma_db')
            client = chromadb.PersistentClient(path=chroma_path)

            # Check if KB changed since last indexing
            kb_hash = _compute_kb_hash()
            hash_file = Path(chroma_path) / 'kb_hash.txt'

            collection_exists = False
            stored_hash = ''
            try:
                client.get_collection('medical_knowledge')
                collection_exists = True
                if hash_file.exists():
                    stored_hash = hash_file.read_text().strip()
            except Exception:
                pass

            if collection_exists and stored_hash == kb_hash:
                self.collection = client.get_collection('medical_knowledge')
                print(f"[RAG] Using cached ChromaDB ({self.collection.count()} docs)")
                return

            # Re-index
            if collection_exists:
                client.delete_collection('medical_knowledge')
                print("[RAG] KB changed — re-indexing...")

            self.collection = client.create_collection(
                name='medical_knowledge',
                metadata={'hnsw:space': 'cosine'}
            )
            self._populate_collection()

            hash_file.parent.mkdir(parents=True, exist_ok=True)
            hash_file.write_text(kb_hash)

        except Exception as e:
            print(f"[RAG] ChromaDB error: {e}")

    def _populate_collection(self):
        docs = _load_knowledge_base()
        if not docs:
            print("[RAG] Warning: No documents found in knowledge_base/")
            return

        documents = [d['text'] for d in docs]
        metadatas = [d['meta'] for d in docs]
        ids = [d['id'] for d in docs]

        if self.embedder:
            embeddings = self.embedder.encode(documents, show_progress_bar=False).tolist()
            self.collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
        else:
            self.collection.add(documents=documents, metadatas=metadatas, ids=ids)

        print(f"[RAG] Indexed {len(docs)} documents into ChromaDB")

    def _init_llm(self):
        # 1) Prefer Ollama server (local or remote) when enabled.
        if getattr(settings, 'OLLAMA_ENABLED', False) and REQUESTS_AVAILABLE:
            self.ollama_base_url = (getattr(settings, 'OLLAMA_BASE_URL', 'http://127.0.0.1:11434') or '').rstrip('/')
            self.ollama_model = getattr(settings, 'OLLAMA_MODEL', 'qwen2.5:0.5b')
            self.ollama_api_key = getattr(settings, 'OLLAMA_API_KEY', '')
            if self._ollama_healthcheck():
                self.llm_provider = 'ollama'
                print(f"[RAG] Ollama ready: {self.ollama_model} @ {self.ollama_base_url}")
                return
            print("[RAG] Ollama unavailable — falling back to local/remote alternatives")

        # Prefer a local lightweight transformers model for offline responses.
        if getattr(settings, 'LOCAL_LLM_ENABLED', True):
            if TRANSFORMERS_AVAILABLE:
                model_id = getattr(settings, 'LOCAL_LLM_MODEL_ID', DEFAULT_LOCAL_MODEL_ID)
                try:
                    self.tokenizer = AutoTokenizer.from_pretrained(model_id)
                    if torch.cuda.is_available():
                        self.llm = AutoModelForCausalLM.from_pretrained(
                            model_id,
                            torch_dtype=torch.float16,
                            device_map='auto',
                        )
                    else:
                        self.llm = AutoModelForCausalLM.from_pretrained(model_id)
                    self.llm_provider = 'local_transformers'
                    print(f"[RAG] Local Transformers LLM ready: {model_id}")
                    return
                except Exception as e:
                    print(f"[RAG] Local Transformers init error: {e}")
            else:
                print("[RAG] transformers not installed — local LLM disabled")

        # Fallback to Anthropic if local LLM is unavailable.
        if not ANTHROPIC_AVAILABLE:
            return
        key = getattr(settings, 'ANTHROPIC_API_KEY', '') or os.environ.get('ANTHROPIC_API_KEY', '')
        if key:
            try:
                self.llm = anthropic.Anthropic(api_key=key)
                self.llm_provider = 'anthropic'
                print("[RAG] Anthropic client ready")
            except Exception as e:
                print(f"[RAG] Anthropic error: {e}")

    def _ollama_headers(self) -> dict:
        headers = {'Content-Type': 'application/json'}
        if self.ollama_api_key:
            headers['Authorization'] = f"Bearer {self.ollama_api_key}"
        return headers

    def _ollama_healthcheck(self) -> bool:
        try:
            res = requests.get(
                f"{self.ollama_base_url}/api/tags",
                headers=self._ollama_headers(),
                timeout=8,
            )
            return res.status_code == 200
        except Exception as e:
            print(f"[RAG] Ollama healthcheck error: {e}")
            return False

    def _retrieve(self, query: str, k: int = 5, language: str = 'ru') -> tuple[list[str], list[dict], list[float] | None]:
        language = _normalize_language(language)
        if self.collection is not None:
            try:
                n_results = min(max(k * 3, k), self.collection.count())
                if self.embedder:
                    emb = self.embedder.encode([query]).tolist()
                    res = self.collection.query(query_embeddings=emb, n_results=n_results)
                else:
                    res = self.collection.query(query_texts=[query], n_results=n_results)

                docs = res['documents'][0]
                metas = res['metadatas'][0]
                dists = (res.get('distances') or [[None]])[0]
                filtered_docs, filtered_metas, filtered_dists = [], [], []
                for idx, (d, m) in enumerate(zip(docs, metas)):
                    meta_lang = (m or {}).get('language', 'multi')
                    if meta_lang in (language, 'multi', None, ''):
                        filtered_docs.append(d)
                        filtered_metas.append(m)
                        filtered_dists.append(dists[idx] if idx < len(dists) else None)
                if filtered_docs:
                    return filtered_docs[:k], filtered_metas[:k], filtered_dists[:k]
                return docs[:k], metas[:k], dists[:k]
            except Exception as e:
                print(f"[RAG] Retrieval error: {e}")

        # Fallback: keyword search over in-memory docs
        docs = getattr(self, '_fallback_docs', None) or _load_knowledge_base()
        query_lower = query.lower()
        scored = []
        for d in docs:
            d_lang = (d.get('meta') or {}).get('language', 'multi')
            if d_lang not in (language, 'multi', None, ''):
                continue
            score = sum(1 for w in query_lower.split() if len(w) > 3 and w in d['text'].lower())
            scored.append((score, d))
        scored.sort(reverse=True, key=lambda x: x[0])
        top = scored[:k]
        return [d['text'] for _, d in top], [d['meta'] for _, d in top], None

    @staticmethod
    def _prioritize_by_class(docs: list[str], metas: list[dict], class_id: int | None, k: int) -> tuple[list[str], list[dict]]:
        if class_id is None:
            return docs[:k], metas[:k]

        prioritized = []
        others = []
        for d, m in zip(docs, metas):
            if (m or {}).get('class_id') == class_id:
                prioritized.append((d, m))
            else:
                others.append((d, m))

        if prioritized:
            # Strict focus for analysis-linked queries: only class-matched evidence.
            combined = prioritized[:k]
        else:
            combined = others
        docs_out = [d for d, _ in combined[:k]]
        metas_out = [m for _, m in combined[:k]]
        return docs_out, metas_out

    def _generate(self, question: str, context_chunks: list[str], sources: list[dict],
                  system_prompt: str = None, language: str = 'ru') -> str:
        language = _normalize_language(language)
        lang_instruction = _language_instruction(language)
        context = '\n\n'.join(
            f"[Source {i+1} — {s.get('source', 'knowledge_base')}]: {doc}"
            for i, (doc, s) in enumerate(zip(context_chunks, sources))
        )

        if self.llm_provider != 'ollama' and self.llm is None:
            if system_prompt == CLASS_DESCRIPTION_PROMPT:
                return _format_class_description_fallback(question, context_chunks, sources, language=language)
            return _format_fallback(question, context_chunks, sources, language=language)

        if self.llm_provider == 'ollama':
            try:
                messages = [
                    {'role': 'system', 'content': f"{system_prompt or SYSTEM_PROMPT}\n\n{lang_instruction}"},
                    {
                        'role': 'user',
                        'content': (
                            f"Knowledge base context:\n\n{context}\n\n"
                            f"Question: {question}\n\n"
                            "Answer concisely. Cite sources as [1], [2]."
                        )
                    },
                ]

                payload = {
                    'model': self.ollama_model,
                    'messages': messages,
                    'stream': False,
                    'options': {
                        'temperature': getattr(settings, 'OLLAMA_TEMPERATURE', 0.2),
                        'top_p': getattr(settings, 'OLLAMA_TOP_P', 0.9),
                        'num_predict': getattr(settings, 'OLLAMA_MAX_TOKENS', 480),
                    },
                }
                res = requests.post(
                    f"{self.ollama_base_url}/api/chat",
                    headers=self._ollama_headers(),
                    data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                    timeout=90,
                )
                if res.status_code != 200:
                    raise RuntimeError(f"Ollama HTTP {res.status_code}: {res.text[:300]}")

                data = res.json()
                text = (data.get('message') or {}).get('content', '').strip()
                if text:
                    return text
            except Exception as e:
                print(f"[RAG] Ollama generation error: {e}")
                if system_prompt == CLASS_DESCRIPTION_PROMPT:
                    return _format_class_description_fallback(question, context_chunks, sources, language=language)
                return _format_fallback(question, context_chunks, sources, language=language)

        if self.llm_provider == 'local_transformers':
            try:
                messages = [
                    {'role': 'system', 'content': f"{system_prompt or SYSTEM_PROMPT}\n\n{lang_instruction}"},
                    {
                        'role': 'user',
                        'content': (
                            f"Knowledge base context:\n\n{context}\n\n"
                            f"Question: {question}\n\n"
                            "Answer concisely. Cite sources as [1], [2]."
                        )
                    }
                ]
                prompt_ids = self.tokenizer.apply_chat_template(
                    messages,
                    add_generation_prompt=True,
                    return_tensors='pt',
                )
                device = next(self.llm.parameters()).device
                prompt_ids = prompt_ids.to(device)

                output_ids = self.llm.generate(
                    prompt_ids,
                    max_new_tokens=getattr(settings, 'LOCAL_LLM_MAX_NEW_TOKENS', 480),
                    temperature=getattr(settings, 'LOCAL_LLM_TEMPERATURE', 0.0),
                    top_p=getattr(settings, 'LOCAL_LLM_TOP_P', 1.0),
                    do_sample=False,
                    pad_token_id=self.tokenizer.eos_token_id,
                )
                new_tokens = output_ids[0][prompt_ids.shape[-1]:]
                text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
                if text:
                    return text
            except Exception as e:
                print(f"[RAG] Local LLM generation error: {e}")
                if system_prompt == CLASS_DESCRIPTION_PROMPT:
                    return _format_class_description_fallback(question, context_chunks, sources, language=language)
                return _format_fallback(question, context_chunks, sources, language=language)

        response = self.llm.messages.create(
            model='claude-sonnet-4-5-20251001',
            max_tokens=1200,
            system=f"{system_prompt or SYSTEM_PROMPT}\n\n{lang_instruction}",
            messages=[{
                'role': 'user',
                'content': (
                    f"Knowledge base context:\n\n{context}\n\n"
                    f"Question: {question}"
                )
            }]
        )
        return response.content[0].text

    def _generate_assistant(self, question: str, language: str = 'ru') -> str:
        language = _normalize_language(language)
        lang_instruction = _language_instruction(language)

        if self.llm_provider != 'ollama' and self.llm is None:
            return _assistant_fallback(question, language=language)

        if self.llm_provider == 'ollama':
            try:
                messages = [
                    {'role': 'system', 'content': f"{ASSISTANT_PROMPT}\n\n{lang_instruction}"},
                    {'role': 'user', 'content': question},
                ]
                payload = {
                    'model': self.ollama_model,
                    'messages': messages,
                    'stream': False,
                    'options': {
                        'temperature': 0.3,
                        'top_p': 0.9,
                        'num_predict': getattr(settings, 'OLLAMA_MAX_TOKENS', 480),
                    },
                }
                res = requests.post(
                    f"{self.ollama_base_url}/api/chat",
                    headers=self._ollama_headers(),
                    data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                    timeout=90,
                )
                if res.status_code != 200:
                    raise RuntimeError(f"Ollama HTTP {res.status_code}: {res.text[:300]}")

                data = res.json()
                text = (data.get('message') or {}).get('content', '').strip()
                if text:
                    return text
            except Exception as e:
                print(f"[RAG] Assistant generation error (ollama): {e}")
                return _assistant_fallback(question, language=language)

        if self.llm_provider == 'local_transformers':
            try:
                messages = [
                    {'role': 'system', 'content': f"{ASSISTANT_PROMPT}\n\n{lang_instruction}"},
                    {'role': 'user', 'content': question},
                ]
                prompt_ids = self.tokenizer.apply_chat_template(
                    messages,
                    add_generation_prompt=True,
                    return_tensors='pt',
                )
                device = next(self.llm.parameters()).device
                prompt_ids = prompt_ids.to(device)
                output_ids = self.llm.generate(
                    prompt_ids,
                    max_new_tokens=getattr(settings, 'LOCAL_LLM_MAX_NEW_TOKENS', 320),
                    temperature=0.2,
                    top_p=0.9,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                )
                new_tokens = output_ids[0][prompt_ids.shape[-1]:]
                text = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()
                if text:
                    return text
            except Exception as e:
                print(f"[RAG] Assistant generation error (local): {e}")
                return _assistant_fallback(question, language=language)

        try:
            response = self.llm.messages.create(
                model='claude-sonnet-4-5-20251001',
                max_tokens=800,
                system=f"{ASSISTANT_PROMPT}\n\n{lang_instruction}",
                messages=[{'role': 'user', 'content': question}],
            )
            return response.content[0].text
        except Exception as e:
            print(f"[RAG] Assistant generation error (anthropic): {e}")
            return _assistant_fallback(question, language=language)

    def _history_critical_summary(self, language: str = 'ru') -> dict | None:
        try:
            from history.models import Analysis
            critical_qs = Analysis.objects.filter(confidence__lt=60.0).order_by('-created_at')[:5]
            urgent_qs = Analysis.objects.filter(class_id=8, confidence__gt=85.0).order_by('-created_at')[:5]

            urgent_count = Analysis.objects.filter(class_id=8, confidence__gt=85.0).count()
            critical_count = Analysis.objects.filter(confidence__lt=60.0).count()

            if language == 'en':
                lines = [
                    f"Critical review summary: {urgent_count} urgent case(s) and {critical_count} low-confidence case(s) in history.",
                    "Please review urgent cases first (adenocarcinoma with confidence > 85%).",
                ]
                if urgent_qs:
                    lines.append("Recent urgent IDs: " + ', '.join(str(x.id) for x in urgent_qs))
                if critical_qs:
                    lines.append("Recent low-confidence IDs: " + ', '.join(str(x.id) for x in critical_qs))
                lines.append("This information is for research purposes only. Not for clinical use.")
            else:
                lines = [
                    f"Сводка по критическим случаям: срочных {urgent_count}, низкоуверенных {critical_count}.",
                    "В первую очередь проверьте срочные случаи (аденокарцинома с уверенностью > 85%).",
                ]
                if urgent_qs:
                    lines.append("Последние срочные ID: " + ', '.join(str(x.id) for x in urgent_qs))
                if critical_qs:
                    lines.append("Последние низкоуверенные ID: " + ', '.join(str(x.id) for x in critical_qs))
                lines.append("Только для исследовательских целей. Не для клинического применения.")

            return {
                'answer': '\n'.join(lines),
                'sources': [{'index': 1, 'source': 'history_db', 'type': 'internal_stats', 'references': ''}],
                'documents_used': 1,
            }
        except Exception as e:
            print(f"[RAG] History critical summary error: {e}")
            return None

    def query(self, question: str, classification_result: dict = None, k: int = 5, language: str = 'ru', mode: str = 'rag') -> dict:
        language = _normalize_language(language)
        mode = (mode or 'rag').strip().lower()

        if mode in {'assistant', 'jarvis', 'copilot'}:
            answer = self._generate_assistant(question, language=language)
            return {'answer': answer, 'sources': [], 'documents_used': 0, 'mode': 'assistant'}

        if _looks_like_greeting(question):
            return {'answer': _greeting_message(language), 'sources': [], 'documents_used': 0, 'mode': 'rag'}

        if _looks_like_history_critical_query(question):
            hist_resp = self._history_critical_summary(language=language)
            if hist_resp:
                hist_resp['mode'] = 'rag'
                return hist_resp

        enriched = question
        if classification_result:
            enriched += (
                f" Class {classification_result.get('class_id')} — "
                f"{classification_result.get('class_name')}, "
                f"confidence {classification_result.get('confidence')}%"
            )

        docs, metas, dists = self._retrieve(enriched, k=k, language=language)
        class_id = None
        if classification_result:
            try:
                class_id = int(classification_result.get('class_id'))
            except Exception:
                class_id = None
        if dists:
            threshold = float(getattr(settings, 'RAG_DISTANCE_THRESHOLD', 0.6))
            filtered = [(d, m, dist) for d, m, dist in zip(docs, metas, dists) if dist is None or dist <= threshold]
            if filtered:
                docs = [x[0] for x in filtered]
                metas = [x[1] for x in filtered]
            else:
                return {'answer': _no_data_message(language), 'sources': [], 'documents_used': 0}

        docs, metas = self._prioritize_by_class(docs, metas, class_id, k)
        if not docs:
            return {'answer': _no_data_message(language), 'sources': [], 'documents_used': 0}

        sources = [
            {
                'index': i + 1,
                'source': m.get('source', 'knowledge_base'),
                'type': m.get('type', 'general'),
                'references': m.get('references', ''),
            }
            for i, m in enumerate(metas)
        ]

        answer = self._generate(question, docs, sources, system_prompt=SYSTEM_PROMPT, language=language)
        return {'answer': answer, 'sources': sources, 'documents_used': len(sources), 'mode': 'rag'}

    def describe_class(self, class_id: int, classification_result: dict = None, language: str = 'ru') -> dict:
        language = _normalize_language(language)
        cls_name = classification_result.get('class_name', f'Class {class_id}') if classification_result else f'Class {class_id}'
        cls_name_ru = (classification_result or {}).get('class_name_ru', '')
        confidence = (classification_result or {}).get('confidence', '')

        if language == 'en':
            question = (
                f"Describe tissue class '{cls_name}' (ID {class_id}):\n"
                f"- what tissue type it is\n"
                f"- key morphological features\n"
                f"- clinical significance\n"
                f"- recommendations for pathology reporting according to protocols"
            )
        else:
            question = (
                f"Опиши класс ткани '{cls_name_ru or cls_name}' (ID {class_id}):\n"
                f"- что это за ткань\n"
                f"- ключевые морфологические признаки\n"
                f"- клиническое значение\n"
                f"- рекомендации для патолога согласно протоколам"
            )

        enriched = question
        if classification_result:
            enriched += (
                f"\n\nДополнительно: уверенность модели {confidence}%, "
                f"английское название класса: {cls_name}"
            )

        docs, metas, _ = self._retrieve(enriched, k=5, language=language)
        docs, metas = self._prioritize_by_class(docs, metas, class_id, 5)
        sources = [
            {
                'index': i + 1,
                'source': m.get('source', 'knowledge_base'),
                'type': m.get('type', 'general'),
                'references': m.get('references', ''),
            }
            for i, m in enumerate(metas)
        ]

        answer = self._generate(question, docs, sources, system_prompt=CLASS_DESCRIPTION_PROMPT, language=language)
        return {'answer': answer, 'sources': sources, 'documents_used': len(sources)}
