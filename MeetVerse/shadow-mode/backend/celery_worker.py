"""
Celery worker entry point
"""
from app.celery_app import celery_app
from app.tasks import process_ai_task

if __name__ == "__main__":
    celery_app.start()

