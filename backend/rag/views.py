from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .engine import RAGEngine


class RAGQueryView(APIView):
    def post(self, request):
        question = request.data.get('question', '').strip()
        if not question:
            return Response({'error': 'No question provided'}, status=400)

        classification_result = request.data.get('classification_result')
        language = request.data.get('language', 'ru')
        engine = RAGEngine.get_instance()
        result = engine.query(question, classification_result, language=language)
        result['provider'] = getattr(engine, 'llm_provider', 'unknown')
        return Response(result)
