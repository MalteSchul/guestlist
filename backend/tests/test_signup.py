"""The event's open link: everyone with it may sign up (D36)."""

import pytest
from fastapi.testclient import TestClient

from app.services.invites import TOKEN_ALPHABET
from tests.test_guest import EVENTS, GUEST, in_days

SIGNUP = "/api/guest/signup"


@pytest.fixture
def event(client: TestClient) -> dict:
    """An event with its open link turned on."""
    event = client.post(EVENTS, json={"title": "Grillabend", "starts_at": in_days(10)}).json()
    return client.put(f"{EVENTS}/{event['id']}/signup").json()


def with_link(event: dict) -> dict:
    return {"X-Signup-Token": event["signup_token"]}


def sign_up(client: TestClient, event: dict, *names: str):
    body = {"persons": [{"name": name} for name in names]}
    return client.post(SIGNUP, json=body, headers=with_link(event))


def test_the_link_is_off_until_the_host_turns_it_on(client: TestClient):
    created = client.post(EVENTS, json={"title": "Fest", "starts_at": in_days(10)}).json()
    assert created["signup_token"] is None

    opened = client.put(f"{EVENTS}/{created['id']}/signup").json()
    token = opened["signup_token"]
    assert len(token) == 44
    assert set(token) <= set(TOKEN_ALPHABET)
    assert client.get(f"{EVENTS}/{created['id']}").json()["signup_token"] == token


def test_a_replaced_or_closed_link_stops_working(client: TestClient, event: dict):
    url = f"{EVENTS}/{event['id']}/signup"
    replaced = client.put(url).json()
    assert replaced["signup_token"] != event["signup_token"]
    assert client.get(SIGNUP, headers=with_link(event)).status_code == 404
    assert sign_up(client, event, "Anna").status_code == 404
    assert client.get(SIGNUP, headers=with_link(replaced)).status_code == 200

    # Who already signed up keeps their own link.
    token = sign_up(client, replaced, "Anna").json()["token"]
    assert client.delete(url).json()["signup_token"] is None
    assert client.get(SIGNUP, headers=with_link(replaced)).status_code == 404
    assert client.get(GUEST, headers={"X-Invite-Token": token}).status_code == 200


def test_only_admins_turn_the_link_on_or_off(client: TestClient, event: dict, log_in_as):
    url = f"{EVENTS}/{event['id']}/signup"
    log_in_as("viewer@example.com", event["id"], "viewer")
    assert client.put(url).status_code == 403
    assert client.delete(url).status_code == 403
    log_in_as("stranger@example.com")
    assert client.put(url).status_code == 404


def test_the_link_shows_the_event_and_nobody_on_it(client: TestClient, event: dict):
    sign_up(client, event, "Anna")
    data = client.get(SIGNUP, headers=with_link(event)).json()
    assert data["event"]["title"] == "Grillabend"
    assert data["event"]["answers_open"] is True
    assert data.keys() == {"event"}
    assert client.get(SIGNUP, headers={"X-Signup-Token": "nope"}).status_code == 404
    assert client.get(SIGNUP).status_code == 422


def test_signing_up_makes_an_invite_of_their_own(client: TestClient, event: dict):
    response = sign_up(client, event, " Anna ", "Tom", "Lea")
    assert response.status_code == 201
    token = response.json()["token"]
    assert token != event["signup_token"]

    guest = client.get(GUEST, headers={"X-Invite-Token": token}).json()
    assert guest["name"] == "Anna, Tom & Lea"
    assert guest["self_registered"] is True
    assert [(p["name"], p["attendance"]) for p in guest["persons"]] == [
        ("Anna", "pending"),
        ("Tom", "pending"),
        ("Lea", "pending"),
    ]

    client.post(
        f"{EVENTS}/{event['id']}/invites", json={"name": "Ben", "persons": [{"name": "Ben"}]}
    )
    listed = client.get(f"{EVENTS}/{event['id']}/invites").json()
    assert {(i["name"], i["self_registered"]) for i in listed} == {
        ("Anna, Tom & Lea", True),
        ("Ben", False),
    }


def test_one_or_two_names(client: TestClient, event: dict):
    for names, expected in ((["Anna"], "Anna"), (["Anna", "Tom"], "Anna & Tom")):
        token = sign_up(client, event, *names).json()["token"]
        assert client.get(GUEST, headers={"X-Invite-Token": token}).json()["name"] == expected


@pytest.mark.parametrize("names", [[], [""], ["  "], [f"Gast {i}" for i in range(11)]])
def test_names_are_checked(client: TestClient, event: dict, names: list[str]):
    assert sign_up(client, event, *names).status_code == 422


def test_sign_up_closes_with_the_answers(client: TestClient, event: dict):
    client.put(f"{EVENTS}/{event['id']}", json={"title": event["title"], "starts_at": in_days(-1)})
    assert client.get(SIGNUP, headers=with_link(event)).json()["event"]["answers_open"] is False
    assert sign_up(client, event, "Anna").status_code == 409
