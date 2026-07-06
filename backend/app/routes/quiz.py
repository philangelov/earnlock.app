from flask import Blueprint, jsonify, g
from app.middleware.auth import require_auth

quiz_bp = Blueprint("quiz", __name__, url_prefix="/quiz")


@quiz_bp.post("/generate")
@require_auth
def generate_quiz():
    return jsonify({
        "quiz_id": "mock-quiz-001",
        "user_id": g.user_id,
        "questions": [
            {
                "id": "q1",
                "text": "What is the time complexity of binary search?",
                "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                "correct_index": 1,
            }
        ],
        "generated_at": "2026-07-06T00:00:00Z",
    })


@quiz_bp.post("/submit")
@require_auth
def submit_quiz():
    return jsonify({
        "quiz_id": "mock-quiz-001",
        "user_id": g.user_id,
        "score": 1,
        "total": 1,
        "passed": True,
        "unlock_granted": True,
        "submitted_at": "2026-07-06T00:00:00Z",
    })
