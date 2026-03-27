# API Quick Reference

Base URL: `http://localhost:8000`

## Analysis

- `POST /api/analyze/`
  - Full pipeline: classification + segmentation + rag_description.

## Classification

- `POST /api/classify/`
  - Только классификация.

## Segmentation

- `POST /api/segment/`
  - Только сегментация.

## RAG

- `POST /api/rag/query/`
  - Поля:
    - `question`: string
    - `language`: `ru` | `en`
    - `classification_result` (optional): объект с `class_id`, `class_name`, `confidence`.

## History

- `GET /api/history/`
- `GET /api/history/<id>/`
- `DELETE /api/history/<id>/`
- `GET /api/stats/`
- `GET /api/history/export/`

## Report

- `GET /api/report/<id>/`
- `GET /api/report/<id>/?force=1`
  - Принудительная регенерация PDF.

## Пример RAG запроса

```json
{
  "question": "Summarize morphology for Tumor Epithelium",
  "language": "en",
  "classification_result": {
    "class_id": 11,
    "class_name": "Tumor Epithelium",
    "confidence": 99.8
  }
}
```
