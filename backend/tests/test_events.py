from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PersonAnswer
from tests.helpers import check_deferred_constraints, pick_option

EVENTS = "/api/admin/events"
EVENT = {"title": "Sommerfest", "starts_at": "2030-07-01T18:00:00+02:00"}
FOOD = {
    "label": "Essen",
    "kind": "choice",
    "options": [{"label": "Fleisch"}, {"label": "Vegetarisch", "position": 1}],
}


def create_event(client: TestClient, **fields) -> dict:
    response = client.post(EVENTS, json=EVENT | fields)
    assert response.status_code == 201, response.text
    return response.json()


def add_question(client: TestClient, event_id: str, question: dict = FOOD) -> dict:
    response = client.post(f"{EVENTS}/{event_id}/questions", json=question)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_list_and_get(client: TestClient):
    event = create_event(client, location="Gartenstraße 1")
    assert event["title"] == "Sommerfest"
    assert event["questions"] == []
    assert "sections" not in event  # extra info is part of the description (D35)

    assert [e["id"] for e in client.get(EVENTS).json()] == [event["id"]]
    assert client.get(f"{EVENTS}/{event['id']}").json() == event


def test_update_replaces_the_event(client: TestClient):
    event = create_event(client, location="Gartenstraße 1")
    changed = EVENT | {"title": "Summer party"}
    response = client.put(f"{EVENTS}/{event['id']}", json=changed)
    assert response.status_code == 200
    assert response.json()["title"] == "Summer party"
    assert response.json()["location"] is None


def test_texts_are_plain_text(client: TestClient):
    """One text in whatever language the host writes, no {"de", "en"} (D16)."""
    assert client.post(EVENTS, json=EVENT | {"title": {"de": "Sommerfest"}}).status_code == 422
    assert client.post(EVENTS, json=EVENT | {"title": "  "}).status_code == 422


def test_end_before_start_is_rejected(client: TestClient):
    response = client.post(EVENTS, json=EVENT | {"ends_at": "2030-07-01T17:00:00+02:00"})
    assert response.status_code == 422


def test_events_of_others_are_invisible(client: TestClient, log_in_as):
    event = create_event(client)
    log_in_as("stranger@example.com")
    assert client.get(EVENTS).json() == []
    assert client.get(f"{EVENTS}/{event['id']}").status_code == 404


def test_viewer_reads_admin_edits_owner_deletes(client: TestClient, log_in_as):
    event = create_event(client)
    url = f"{EVENTS}/{event['id']}"

    log_in_as("viewer@example.com", event["id"], "viewer")
    assert client.get(url).status_code == 200
    assert client.put(url, json=EVENT).status_code == 403

    log_in_as("admin@example.com", event["id"], "admin")
    assert client.put(url, json=EVENT).status_code == 200
    assert client.delete(url).status_code == 403

    log_in_as("owner@example.com", event["id"], "owner")
    assert client.delete(url).status_code == 204
    assert client.get(url).status_code == 404


def test_questions_and_options(client: TestClient):
    event = create_event(client)
    question = add_question(client, event["id"])
    assert [o["label"] for o in question["options"]] == ["Fleisch", "Vegetarisch"]

    url = f"{EVENTS}/{event['id']}/questions"
    text_with_options = FOOD | {"kind": "text"}
    assert client.post(url, json=text_with_options).status_code == 422
    assert client.post(url, json=FOOD | {"options": []}).status_code == 422

    option = client.post(f"{url}/{question['id']}/options", json={"label": "Fisch"})
    assert option.status_code == 201
    assert len(client.get(f"{EVENTS}/{event['id']}").json()["questions"][0]["options"]) == 3


def test_children_are_only_found_under_their_own_event(client: TestClient):
    first, second = create_event(client), create_event(client)
    question = add_question(client, first["id"])
    change = {"label": "Essen?"}

    wrong = f"{EVENTS}/{second['id']}/questions/{question['id']}"
    assert client.put(wrong, json=change).status_code == 404
    right = f"{EVENTS}/{first['id']}/questions/{question['id']}"
    assert client.put(right, json=change).status_code == 200


def test_picked_option_can_only_be_deactivated(client: TestClient, session: Session):
    event = create_event(client)
    question = add_question(client, event["id"])
    picked, unpicked = question["options"]
    pick_option(session, picked["id"])
    options = f"{EVENTS}/{event['id']}/questions/{question['id']}/options"

    assert client.delete(f"{options}/{picked['id']}").status_code == 409
    deactivate = {"label": picked["label"], "active": False}
    assert client.put(f"{options}/{picked['id']}", json=deactivate).json()["active"] is False
    assert client.delete(f"{options}/{unpicked['id']}").status_code == 204
    check_deferred_constraints(session)


def test_deleting_a_question_deletes_its_answers(client: TestClient, session: Session):
    event = create_event(client)
    question = add_question(client, event["id"])
    pick_option(session, question["options"][0]["id"])

    url = f"{EVENTS}/{event['id']}/questions/{question['id']}"
    assert client.delete(url).status_code == 204
    check_deferred_constraints(session)
    assert session.scalar(select(func.count()).select_from(PersonAnswer)) == 0


def test_list_counts_attendance(client: TestClient):
    event = create_event(client)
    invite = {"name": "Familie Müller", "persons": [{"name": "Anna"}, {"name": "Ben"}]}
    client.post(f"{EVENTS}/{event['id']}/invites", json=invite)
    empty = create_event(client)
    counts = {e["id"]: e["attendance"] for e in client.get(EVENTS).json()}
    assert counts[event["id"]] == {"yes": 0, "maybe": 0, "no": 0, "pending": 2}
    assert counts[empty["id"]] == {"yes": 0, "maybe": 0, "no": 0, "pending": 0}


def test_duplicate_copies_setup_but_not_invites(client: TestClient):
    event = create_event(
        client, description="Parken\nIm Hof", location="Gartenstraße 1", guest_list_enabled=True
    )
    url = f"{EVENTS}/{event['id']}"
    question = add_question(client, event["id"])
    hidden = question["options"][1]
    options = f"{url}/questions/{question['id']}/options"
    client.put(f"{options}/{hidden['id']}", json={"label": hidden["label"], "active": False})
    client.post(f"{url}/invites", json={"name": "Anna", "persons": [{"name": "Anna"}]})

    response = client.post(f"{url}/duplicate")
    assert response.status_code == 201
    copy = response.json()
    assert copy["id"] != event["id"]
    assert (
        copy["title"],
        copy["description"],
        copy["location"],
        copy["guest_list_enabled"],
    ) == (event["title"], "Parken\nIm Hof", "Gartenstraße 1", True)
    assert [o["label"] for o in copy["questions"][0]["options"]] == ["Fleisch"]
    assert client.get(f"{EVENTS}/{copy['id']}/invites").json() == []


def test_duplicate_needs_access(client: TestClient, log_in_as):
    event = create_event(client)
    log_in_as("stranger@example.com")
    assert client.post(f"{EVENTS}/{event['id']}/duplicate").status_code == 404
