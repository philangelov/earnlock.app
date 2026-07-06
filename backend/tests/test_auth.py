def test_quiz_generate_requires_auth(client):
    res = client.post("/quiz/generate")
    assert res.status_code == 401


def test_quiz_submit_requires_auth(client):
    res = client.post("/quiz/submit")
    assert res.status_code == 401


def test_quiz_generate_rejects_invalid_token(client):
    res = client.post(
        "/quiz/generate",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert res.status_code == 401
