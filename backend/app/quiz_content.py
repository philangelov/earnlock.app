"""Static question bank for the MVP (stubbed "AI" generation).

POST /quiz/generate builds a quiz from this bank and stores it (with answer keys)
via the repo; only the public view (no answers) goes to the client. When the real
generator is wired in (architecture.md §6), it replaces `build_questions` and returns
the same shape, so nothing downstream changes.

Every question carries a `subject` from `validation.VALID_SUBJECTS`. It is what
/quiz/submit tallies into `subject_stats`, which is the only reason Insights can show a
mastery bar per subject rather than a number someone made up.
"""

QUESTION_BANK: list[dict] = [
    {
        "prompt": "Which organelle is known as the “powerhouse” of the cell?",
        "options": ["Golgi apparatus", "Mitochondrion", "Nucleus", "Ribosome"],
        "correct_index": 1,
        "concept": "Mitochondria turn nutrients and oxygen into ATP for the cell.",
        "subject": "Biology",
    },
    {
        "prompt": "In which year did the Berlin Wall fall?",
        "options": ["1979", "1989", "1991", "1985"],
        "correct_index": 1,
        "concept": "The Berlin Wall was opened on 9 November 1989.",
        "subject": "History",
    },
    {
        "prompt": "A triangle’s interior angles always add up to how many degrees?",
        "options": ["90", "180", "270", "360"],
        "correct_index": 1,
        "concept": "The interior angles of any triangle sum to 180°.",
        "subject": "Math",
    },
    {
        "prompt": "What gas do plants release during photosynthesis?",
        "options": ["Nitrogen", "Carbon dioxide", "Helium", "Oxygen"],
        "correct_index": 3,
        "concept": "Plants take in CO₂ and release oxygen as a byproduct.",
        "subject": "Biology",
    },
    {
        "prompt": "Which data structure follows First-In-First-Out (FIFO) order?",
        "options": ["Stack", "Queue", "Tree", "Set"],
        "correct_index": 1,
        "concept": "A queue serves the oldest inserted item first.",
        "subject": "Coding",
    },
    {
        "prompt": "What is 9 × 6?",
        "options": ["54", "42", "48", "56"],
        "correct_index": 0,
        "concept": "Nine groups of six make 54.",
        "subject": "Math",
    },
    {
        "prompt": "Which planet is known as the Red Planet?",
        "options": ["Venus", "Jupiter", "Mars", "Mercury"],
        "correct_index": 2,
        "concept": "Mars looks red because of iron-oxide dust on its surface.",
        "subject": "Physics",
    },
]


#: Cloze exercises for the recap step, in the same raw shape the AI generator emits
#: (`distractors`, not `options` — `validate_recap` is what decides the option order).
RECAP_BANK: list[dict] = [
    {
        "sentence_before": "A triangle’s interior angles always add up to",
        "sentence_after": "degrees.",
        "answer": "180",
        "distractors": ["90", "360"],
    },
    {
        "sentence_before": "During photosynthesis, plants release",
        "sentence_after": "into the air.",
        "answer": "oxygen",
        "distractors": ["nitrogen", "helium"],
    },
    {
        "sentence_before": "The mitochondrion turns nutrients and oxygen into",
        "sentence_after": "for the cell.",
        "answer": "ATP",
        "distractors": ["DNA", "protein"],
    },
    {
        "sentence_before": "A queue always serves the",
        "sentence_after": "item first.",
        "answer": "oldest",
        "distractors": ["newest", "largest"],
    },
]


def build_recap(count: int) -> dict:
    """The offline recap for a quiz of `count` questions.

    Indexed by `count` for the same reason `build_questions` cycles the bank: it must be
    deterministic (so tests can assert on it) without being the same sentence forever —
    a 5-question quiz and a 7-question debt quiz recap different ideas.
    """
    return dict(RECAP_BANK[count % len(RECAP_BANK)])


def build_questions(count: int) -> list[dict]:
    """Full quiz items (with answer keys), ids q1..qN, for the given length.

    Cycles through the bank when count exceeds it, so a configured quiz length
    (QUIZ_LEN_NORMAL / QUIZ_LEN_DEBT) is always honored rather than silently
    truncated to the bank size.
    """
    items = []
    for i in range(count):
        q = QUESTION_BANK[i % len(QUESTION_BANK)]
        items.append(
            {
                "id": f"q{i + 1}",
                "prompt": q["prompt"],
                "options": q["options"],
                "correct_index": q["correct_index"],
                "concept": q.get("concept"),
                "subject": q.get("subject"),
            }
        )
    return items


def public_view(questions: list[dict]) -> list[dict]:
    """Client-safe view: drop correct_index and concept (never leak the answers).

    `subject` is safe to expose — it labels a question, it doesn't answer one.
    """
    return [
        {
            "id": q["id"],
            "prompt": q["prompt"],
            "options": q["options"],
            "subject": q.get("subject"),
        }
        for q in questions
    ]


def subject_tally(questions: list[dict], results: list[dict]) -> list[dict]:
    """Fold a graded attempt into ``[{subject, correct, total}]`` for `subject_stats`.

    Questions with no subject — an older stored quiz, or a generator that declined to
    label one — are skipped rather than swept into a catch-all bucket: an unlabelled
    answer is genuinely unknown, and a mastery bar for a subject nobody studied is
    worse than no bar at all.
    """
    correct_by_id = {r["id"]: r["correct"] for r in results}
    tally: dict[str, dict[str, int]] = {}
    for question in questions:
        subject = question.get("subject")
        if not subject:
            continue
        bucket = tally.setdefault(
            subject, {"subject": subject, "correct": 0, "total": 0}
        )
        bucket["total"] += 1
        if correct_by_id.get(question["id"]):
            bucket["correct"] += 1
    return list(tally.values())
