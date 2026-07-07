"""Static question bank for the MVP (stubbed "AI" generation).

POST /quiz/generate builds a quiz from this bank and stores it (with answer keys)
via the repo; only the public view (no answers) goes to the client. When the real
generator is wired in (architecture.md §6), it replaces `build_questions` and returns
the same shape, so nothing downstream changes.
"""

QUESTION_BANK: list[dict] = [
    {
        "prompt": "Which organelle is known as the “powerhouse” of the cell?",
        "options": ["Golgi apparatus", "Mitochondrion", "Nucleus", "Ribosome"],
        "correct_index": 1,
        "concept": "Mitochondria turn nutrients and oxygen into ATP for the cell.",
    },
    {
        "prompt": "In which year did the Berlin Wall fall?",
        "options": ["1979", "1989", "1991", "1985"],
        "correct_index": 1,
        "concept": "The Berlin Wall was opened on 9 November 1989.",
    },
    {
        "prompt": "A triangle’s interior angles always add up to how many degrees?",
        "options": ["90", "180", "270", "360"],
        "correct_index": 1,
        "concept": "The interior angles of any triangle sum to 180°.",
    },
    {
        "prompt": "What gas do plants release during photosynthesis?",
        "options": ["Nitrogen", "Carbon dioxide", "Helium", "Oxygen"],
        "correct_index": 3,
        "concept": "Plants take in CO₂ and release oxygen as a byproduct.",
    },
    {
        "prompt": "Which data structure follows First-In-First-Out (FIFO) order?",
        "options": ["Stack", "Queue", "Tree", "Set"],
        "correct_index": 1,
        "concept": "A queue serves the oldest inserted item first.",
    },
    {
        "prompt": "What is 9 × 6?",
        "options": ["54", "42", "48", "56"],
        "correct_index": 0,
        "concept": "Nine groups of six make 54.",
    },
    {
        "prompt": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Jupiter", "Mars", "Mercury"],
        "correct_index": 2,
        "concept": "Mars looks red because of iron-oxide dust on its surface.",
    },
]


def build_questions(count: int) -> list[dict]:
    """Full quiz items (with answer keys), ids q1..qN, for the given length."""
    items = []
    for i, q in enumerate(QUESTION_BANK[:count], start=1):
        items.append(
            {
                "id": f"q{i}",
                "prompt": q["prompt"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "concept": q.get("concept"),
            }
        )
    return items


def public_view(questions: list[dict]) -> list[dict]:
    """Client-safe view: drop correct_index and concept (never leak the answers)."""
    return [
        {"id": q["id"], "prompt": q["prompt"], "options": q["options"]}
        for q in questions
    ]
