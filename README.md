# Medical Analysis API

Бэкенд для обработки медицинских анализов с OCR и AI.

## Стек

- Python 3.11 + FastAPI
- PostgreSQL + SQLAlchemy
- Tesseract OCR
- OpenAI/Claude API для парсинга
- Docker

## Запуск

```bash
# docker
docker-compose up -d --build
docker-compose exec api alembic upgrade head

# или локально
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## API

Swagger UI: http://localhost:8000/docs

Основные эндпоинты:
- POST `/api/v1/analyses/upload` - загрузить анализ
- GET `/api/v1/analyses` - список
- GET `/api/v1/analyses/{id}` - детали

## Env

```
DATABASE_URL=postgresql+asyncpg://...
OPENAI_API_KEY=sk-...
SECRET_KEY=<random>
```

## Как работает

1. Загружаешь PDF/фото
2. Tesseract вытаскивает текст
3. AI парсит в JSON с биомаркерами
4. Сравнение с нормами
5. Генерация рекомендаций по БАДам

## License

Proprietary
