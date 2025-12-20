### Local setup (no Docker)

### Backend (Django)

- **Create venv + install deps**:

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt -r requirements-dev.txt
```

- **Configure env**:
  - Use your existing `backend/.env` (or set env vars in your shell)
  - At minimum, set `SECRET_KEY` (required when `DEBUG=False`)

- **Migrate + run**:

```bash
python manage.py migrate
python manage.py runserver
```

### Frontend (React)

```bash
cd frontend
npm ci
npm start
```

### Seeding dummy data

- Exercises seed:

```bash
cd backend
python manage.py seed_exercises
```

- Ensure each lesson has baseline sections (text/video/exercises):

```bash
cd backend
python manage.py ensure_lesson_sections
```
