from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.services.invites import TOKEN_ALPHABET

EVENTS = "/api/admin/events"
GUEST = "/api/guest/invite"

FOOD = {
    "label": "Essen",
    "kind": "choice",
    "required": True,
    "options": [{"label": "Fleisch"}, {"label": "Vegetarisch", "position": 1}],
}
DRINKS = {
    "label": "Getränke",
    "kind": "choice",
    "multiple": True,
    "position": 1,
    "options": [{"label": "Wein"}, {"label": "Wasser", "position": 1}],
}
ALLERGIES = {"label": "Allergien", "kind": "text", "position": 2}


def in_days(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


@pytest.fixture
def party(client: TestClient) -> dict:
    """An event with three questions and one invite for Anna and Ben."""
    event = client.post(EVENTS, json={"title": "Sommerfest", "starts_at": in_days(30)})
    event = event.json()
    questions = [
        client.post(f"{EVENTS}/{event['id']}/questions", json=q).json()
        for q in (FOOD, DRINKS, ALLERGIES)
    ]
    invite = client.post(
        f"{EVENTS}/{event['id']}/invites",
        json={"name": "Familie Müller", "persons": [{"name": "Anna"}, {"name": "Ben"}]},
    ).json()
    return {"event": event, "food": questions[0], "drinks": questions[1], "text": questions[2]} | {
        "invite": invite,
        "anna": invite["persons"][0]["id"],
        "ben": invite["persons"][1]["id"],
    }


def as_guest(party: dict) -> dict:
    return {"X-Invite-Token": party["invite"]["token"]}


def save(client: TestClient, party: dict, *persons: dict, comment: str | None = None):
    body = {"comment": comment, "persons": list(persons)}
    return client.put(GUEST, json=body, headers=as_guest(party))


def answer(question: dict, option: int | None = None, text: str | None = None) -> dict:
    if option is None:
        return {"question_id": question["id"], "text_value": text}
    return {"question_id": question["id"], "option_ids": [question["options"][option]["id"]]}


# Hosts


def test_host_creates_lists_and_deletes_invites(client: TestClient, party: dict, log_in_as):
    invite = party["invite"]
    assert len(invite["token"]) == 44
    assert set(invite["token"]) <= set(TOKEN_ALPHABET)
    assert [(p["name"], p["attendance"]) for p in invite["persons"]] == [
        ("Anna", "pending"),
        ("Ben", "pending"),
    ]
    url = f"{EVENTS}/{party['event']['id']}/invites"
    assert [i["id"] for i in client.get(url).json()] == [invite["id"]]

    log_in_as("viewer@example.com", party["event"]["id"], "viewer")
    assert client.get(url).status_code == 200
    assert client.delete(f"{url}/{invite['id']}").status_code == 403

    log_in_as("stranger@example.com")
    assert client.get(url).status_code == 404


# Guests


def test_guest_sees_the_event_and_their_invite(client: TestClient, party: dict):
    options = f"{EVENTS}/{party['event']['id']}/questions/{party['food']['id']}/options"
    meat = party["food"]["options"][0]
    client.put(f"{options}/{meat['id']}", json={"label": meat["label"], "active": False})

    response = client.get(GUEST, headers=as_guest(party))
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Familie Müller"
    assert data["event"]["answers_open"] is True
    assert [p["name"] for p in data["persons"]] == ["Anna", "Ben"]
    assert "token" not in data
    food = data["event"]["questions"][0]
    assert [o["label"] for o in food["options"]] == ["Vegetarisch"]


def test_unknown_or_missing_token(client: TestClient):
    assert client.get(GUEST, headers={"X-Invite-Token": "nope"}).status_code == 404
    assert client.get(GUEST).status_code == 422


def test_guest_saves_attendance_answers_and_comment(client: TestClient, party: dict):
    anna = {
        "id": party["anna"],
        "attendance": "yes",
        "answers": [
            answer(party["food"], 1),
            {
                "question_id": party["drinks"]["id"],
                "option_ids": [o["id"] for o in party["drinks"]["options"]],
            },
            answer(party["text"], text="Nüsse"),
        ],
    }
    response = save(client, party, anna, {"id": party["ben"], "attendance": "no"}, comment="Hi!")
    assert response.status_code == 200, response.text

    hosts_view = client.get(f"{EVENTS}/{party['event']['id']}/invites").json()[0]
    assert hosts_view["comment"] == "Hi!"
    anna_seen, ben_seen = hosts_view["persons"]
    assert anna_seen["attendance"] == "yes"
    assert anna_seen["attendance_changed_at"] is not None
    assert {a["question_id"]: (a["option_ids"], a["text_value"]) for a in anna_seen["answers"]} == {
        party["food"]["id"]: ([party["food"]["options"][1]["id"]], None),
        party["drinks"]["id"]: ([o["id"] for o in party["drinks"]["options"]], None),
        party["text"]["id"]: ([], "Nüsse"),
    }
    assert ben_seen["attendance"] == "no"
    assert ben_seen["answers"] == []


def test_attendance_time_only_moves_when_attendance_changes(client: TestClient, party: dict):
    def anna_after(attendance: str, food: int) -> str:
        person = {
            "id": party["anna"],
            "attendance": attendance,
            "answers": [answer(party["food"], food)],
        }
        return save(client, party, person).json()["persons"][0]["attendance_changed_at"]

    first = anna_after("yes", 0)
    assert anna_after("yes", 1) == first
    assert anna_after("maybe", 1) != first


def test_required_questions_bind_only_yes(client: TestClient, party: dict):
    assert save(client, party, {"id": party["anna"], "attendance": "yes"}).status_code == 422
    assert save(client, party, {"id": party["anna"], "attendance": "maybe"}).status_code == 200


def test_single_choice_takes_one_option(client: TestClient, party: dict):
    both = {
        "question_id": party["food"]["id"],
        "option_ids": [o["id"] for o in party["food"]["options"]],
    }
    person = {"id": party["anna"], "attendance": "maybe", "answers": [both]}
    assert save(client, party, person).status_code == 422


def test_questions_and_options_of_other_events_are_rejected(client: TestClient, party: dict):
    other = client.post(EVENTS, json={"title": "Anderes", "starts_at": in_days(9)}).json()
    foreign = client.post(f"{EVENTS}/{other['id']}/questions", json=FOOD).json()

    person = {"id": party["anna"], "attendance": "maybe", "answers": [answer(foreign, 0)]}
    assert save(client, party, person).status_code == 422
    foreign_option = {
        "question_id": party["food"]["id"],
        "option_ids": [foreign["options"][0]["id"]],
    }
    person["answers"] = [foreign_option]
    assert save(client, party, person).status_code == 422


def test_inactive_option_cannot_be_picked_but_an_earlier_pick_stays(
    client: TestClient, party: dict
):
    person = {"id": party["anna"], "attendance": "yes", "answers": [answer(party["food"], 0)]}
    assert save(client, party, person).status_code == 200

    meat = party["food"]["options"][0]
    options = f"{EVENTS}/{party['event']['id']}/questions/{party['food']['id']}/options"
    client.put(f"{options}/{meat['id']}", json={"label": meat["label"], "active": False})

    assert save(client, party, person).status_code == 200  # Anna keeps her choice
    ben = {"id": party["ben"], "attendance": "yes", "answers": [answer(party["food"], 0)]}
    assert save(client, party, ben).status_code == 422  # Ben can't pick it any more


def test_answers_left_out_are_removed(client: TestClient, party: dict):
    with_text = [answer(party["food"], 0), answer(party["text"], text="Nüsse")]
    save(client, party, {"id": party["anna"], "attendance": "yes", "answers": with_text})
    without = [answer(party["food"], 0)]
    response = save(client, party, {"id": party["anna"], "attendance": "yes", "answers": without})
    assert [a["question_id"] for a in response.json()["persons"][0]["answers"]] == [
        party["food"]["id"]
    ]


def test_persons_of_other_invites_are_not_found(client: TestClient, party: dict):
    url = f"{EVENTS}/{party['event']['id']}/invites"
    other = client.post(url, json={"name": "Andere", "persons": [{"name": "Carla"}]}).json()
    person = {"id": other["persons"][0]["id"], "attendance": "no"}
    assert save(client, party, person).status_code == 404


def test_answers_close_at_the_deadline_or_the_start(client: TestClient, party: dict):
    event = party["event"]
    url = f"{EVENTS}/{event['id']}"
    started = {"title": event["title"], "starts_at": in_days(-1)}
    client.put(url, json=started)
    assert save(client, party, {"id": party["ben"], "attendance": "no"}).status_code == 409

    # A deadline after the start keeps answers open (D12).
    client.put(url, json=started | {"rsvp_deadline": in_days(1)})
    assert save(client, party, {"id": party["ben"], "attendance": "no"}).status_code == 200


# Guest list (D3, D33)


def test_no_guest_list_unless_the_host_shows_one(client: TestClient, party: dict):
    save(client, party, {"id": party["ben"], "attendance": "no", "attendance_public": True})
    response = client.get(GUEST, headers=as_guest(party))
    assert response.json()["guest_list"] is None
    assert response.json()["event"]["guest_list_enabled"] is False


def test_guest_list_shows_only_people_who_agreed_and_come(client: TestClient, party: dict):
    event = party["event"]
    shown = {"title": event["title"], "starts_at": event["starts_at"], "guest_list_enabled": True}
    assert client.put(f"{EVENTS}/{event['id']}", json=shown).status_code == 200
    url = f"{EVENTS}/{event['id']}/invites"
    other = client.post(url, json={"name": "Carla", "persons": [{"name": "Carla"}]}).json()
    carla = {"X-Invite-Token": other["token"]}
    yes = [answer(party["food"], 0)]
    client.put(
        GUEST,
        json={"persons": [{"id": other["persons"][0]["id"], "attendance": "maybe"}]},
        headers=carla,
    )  # Carla didn't agree to be listed

    response = save(
        client,
        party,
        {"id": party["anna"], "attendance": "yes", "attendance_public": True, "answers": yes},
        {"id": party["ben"], "attendance": "no", "attendance_public": True},
    )
    assert response.status_code == 200, response.text
    assert [p["attendance_public"] for p in response.json()["persons"]] == [True, True]
    # Ben declined, Carla didn't agree; and nothing but name and attendance is shown.
    assert response.json()["guest_list"] == [{"name": "Anna", "attendance": "yes"}]
    assert client.get(GUEST, headers=carla).json()["guest_list"] == [
        {"name": "Anna", "attendance": "yes"}
    ]
