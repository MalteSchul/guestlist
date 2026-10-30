from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Person

EVENTS = "/api/admin/events"
CONTACTS = "/api/admin/contacts"


def at(day: int, hour: int = 0) -> datetime:
    return datetime(2030, 6, day, hour, tzinfo=UTC)


def event(client: TestClient) -> str:
    body = {"title": "Sommerfest", "starts_at": "2030-07-01T18:00:00+02:00"}
    return client.post(EVENTS, json=body).json()["id"]


def invite(client: TestClient, event_id: str, *names: str, **contacts: str) -> None:
    """One invite; `contacts` maps a name to the ID of the contact it comes from."""
    persons = [{"name": name, "contact_id": contacts.get(name)} for name in names]
    response = client.post(
        f"{EVENTS}/{event_id}/invites", json={"name": ", ".join(names), "persons": persons}
    )
    assert response.status_code == 201, response.text


def answer(session: Session, name: str, created, attendance="pending", changed=None) -> None:
    """Set when someone was invited and what they said when: the real times are 'now'."""
    person = session.scalars(select(Person).where(Person.name == name)).one()
    person.created_at = created
    person.attendance = attendance
    person.attendance_changed_at = changed
    session.flush()


def stats(client: TestClient, event_id: str, **grouping: int) -> dict:
    response = client.get(f"{EVENTS}/{event_id}/stats", params=grouping)
    assert response.status_code == 200, response.text
    return response.json()


def steps(data: dict) -> list[tuple]:
    return [
        (datetime.fromisoformat(s["at"]), s["yes"], s["maybe"], s["no"], s["pending"])
        for s in data["timeline"]
    ]


def test_an_event_without_invites_has_empty_stats(client: TestClient):
    data = stats(client, event(client))
    assert data["timeline"] == []
    assert [(b["min_age"], b["max_age"]) for b in data["ages"]][:2] == [(0, 9), (10, 19)]
    assert data["ages"][-1] == {"min_age": 80, "max_age": None, "yes": 0, "maybe": 0}
    assert len(data["ages"]) == 9
    assert all(b["yes"] == b["maybe"] == 0 for b in data["ages"])
    assert data["age_unknown"] == 0


def test_the_timeline_follows_invites_and_answers(client: TestClient, session: Session):
    event_id = event(client)
    invite(client, event_id, "Anna", "Ben")
    invite(client, event_id, "Carla", "Dora")
    answer(session, "Anna", at(10, 10), "yes", at(10, 12))
    answer(session, "Ben", at(10, 10), "maybe", at(11, 9))
    answer(session, "Carla", at(11, 8))
    answer(session, "Dora", at(10, 10), "no", at(12))

    assert steps(stats(client, event_id)) == [
        (at(10, 10), 0, 0, 0, 3),  # Anna, Ben and Dora invited
        (at(10, 12), 1, 0, 0, 2),  # Anna says yes
        (at(11, 8), 1, 0, 0, 3),  # Carla is invited
        (at(11, 9), 1, 1, 0, 2),  # Ben says maybe
        (at(12), 1, 1, 1, 1),  # Dora says no
    ]


def test_the_timeline_copes_with_odd_timestamps(client: TestClient, session: Session):
    event_id = event(client)
    invite(client, event_id, "Anna", "Ben", "Carla")
    answer(session, "Anna", at(10, 10), "yes", None)  # no time recorded: answered when invited
    answer(session, "Ben", at(10, 10), "no", at(9))  # "before" being invited: when invited
    answer(session, "Carla", at(10, 10))  # the same moment as the others: one step

    assert steps(stats(client, event_id)) == [(at(10, 10), 1, 0, 1, 1)]


def test_ages_are_counted_on_the_day_of_the_event(client: TestClient, session: Session):
    event_id = event(client)  # 2030
    born = {"Anna": 2025, "Ben": 1990, "Carla": 1940, "Dora": 2000, "Greta": 1900, "Hans": 2035}
    ids = {
        name: client.post(CONTACTS, json={"name": name, "birth_year": year}).json()["id"]
        for name, year in born.items()
    }
    ids["Fritz"] = client.post(CONTACTS, json={"name": "Fritz"}).json()["id"]  # no birth year
    invite(client, event_id, *ids, **ids)
    invite(client, event_id, "Emil", "Paula")  # not from the address book
    said = {"Anna": "yes", "Ben": "maybe", "Carla": "yes", "Dora": "no", "Greta": "yes"}
    said |= {"Hans": "maybe", "Fritz": "maybe", "Emil": "yes", "Paula": "pending"}
    for name, attendance in said.items():
        answer(session, name, at(1), attendance, at(2))

    data = stats(client, event_id)
    by_age = {b["min_age"]: (b["yes"], b["maybe"]) for b in data["ages"]}
    assert by_age == {
        0: (1, 0),  # Anna, 5
        10: (0, 0),
        20: (0, 0),
        30: (0, 0),
        40: (0, 1),  # Ben, 40
        50: (0, 0),
        60: (0, 0),
        70: (0, 0),
        80: (1, 0),  # Carla, 90: 80 and older
    }
    # Dora said no and Paula nothing: not coming. Greta (130), Hans (born after the event),
    # Fritz (no year) and Emil (no contact) are coming without a usable age.
    assert data["age_unknown"] == 4


def test_ages_can_be_grouped_differently(client: TestClient, session: Session):
    event_id = event(client)  # 2030
    born = {"Anna": 2025, "Ben": 1990, "Carla": 1940, "Dora": 1993, "Emil": 1947}
    ids = {
        name: client.post(CONTACTS, json={"name": name, "birth_year": year}).json()["id"]
        for name, year in born.items()
    }
    invite(client, event_id, *ids, **ids)
    for name in born:
        answer(session, name, at(1), "yes" if name != "Dora" else "maybe", at(2))

    # Ages 5, 40, 90, 37 (maybe) and 83.
    data = stats(client, event_id, age_step=20, age_from=65)
    assert [(b["min_age"], b["max_age"]) for b in data["ages"]] == [
        (0, 19),
        (20, 39),
        (40, 59),
        (60, 64),  # the last closed band stops where the open one starts
        (65, None),
    ]
    assert [(b["yes"], b["maybe"]) for b in data["ages"]] == [
        (1, 0),
        (0, 1),
        (1, 0),
        (0, 0),
        (2, 0),
    ]

    # Everyone from the age on counts together, however old.
    data = stats(client, event_id, age_from=40)
    assert [(b["min_age"], b["yes"], b["maybe"]) for b in data["ages"]] == [
        (0, 1, 0),
        (10, 0, 0),
        (20, 0, 0),
        (30, 0, 1),
        (40, 3, 0),
    ]
    assert data["ages"][-1]["max_age"] is None


def test_every_year_can_be_its_own_group(client: TestClient):
    data = stats(client, event(client), age_step=1, age_from=120)
    assert [b["min_age"] for b in data["ages"]] == list(range(121))
    assert data["ages"][-1]["max_age"] is None
    assert data["ages"][-2]["max_age"] == 119


def test_age_groupings_that_make_no_sense_are_refused(client: TestClient):
    event_id = event(client)
    for grouping in (
        {"age_step": 0},
        {"age_from": 0},
        {"age_step": 121},
    ):
        response = client.get(f"{EVENTS}/{event_id}/stats", params=grouping)
        assert response.status_code == 422, grouping


def test_stats_are_for_people_with_a_role_on_the_event(client: TestClient, log_in_as):
    event_id = event(client)
    invite(client, event_id, "Anna")
    url = f"{EVENTS}/{event_id}/stats"

    log_in_as("viewer@example.com", event_id, "viewer")
    assert client.get(url).status_code == 200

    log_in_as("stranger@example.com")
    assert client.get(url).status_code == 404
