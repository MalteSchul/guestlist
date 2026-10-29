from fastapi.testclient import TestClient

CONTACTS = "/api/admin/contacts"
GROUPS = "/api/admin/groups"
EVENTS = "/api/admin/events"


def contact(client: TestClient, name: str, **fields) -> dict:
    response = client.post(CONTACTS, json={"name": name} | fields)
    assert response.status_code == 201, response.text
    return response.json()


def group(client: TestClient, name: str, members: list[dict], **fields) -> dict:
    body = {"name": name, "member_ids": [m["id"] for m in members]} | fields
    response = client.post(GROUPS, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def event(client: TestClient) -> str:
    body = {"title": "Sommerfest", "starts_at": "2030-07-01T18:00:00+02:00"}
    return client.post(EVENTS, json=body).json()["id"]


# Contacts and groups


def test_contacts_and_groups(client: TestClient):
    tom = contact(client, "Tom", birth_year=1988)
    anna = contact(client, "anna")
    family = group(client, "Familie Müller", [tom, anna])
    assert family["invite_mode"] == "together"
    assert family["member_ids"] == [tom["id"], anna["id"]]

    contacts = client.get(CONTACTS).json()
    assert [c["name"] for c in contacts] == ["anna", "Tom"]  # by name, whatever the case
    assert contacts[1]["birth_year"] == 1988
    assert all(c["group_ids"] == [family["id"]] for c in contacts)


def test_groups_can_be_set_from_the_contact(client: TestClient):
    anna = contact(client, "Anna")
    family = group(client, "Familie", [anna])
    friends = group(client, "Freunde", [], invite_mode="separately")
    tom = contact(client, "Tom", group_ids=[family["id"], friends["id"]])
    assert sorted(tom["group_ids"]) == sorted([family["id"], friends["id"]])

    groups = {g["name"]: g for g in client.get(GROUPS).json()}
    assert groups["Familie"]["member_ids"] == [anna["id"], tom["id"]]  # joins last

    response = client.put(f"{CONTACTS}/{tom['id']}", json={"name": "Tom", "group_ids": []})
    assert response.json()["group_ids"] == []
    assert all(tom["id"] not in g["member_ids"] for g in client.get(GROUPS).json())


def test_group_members_are_replaced_in_order(client: TestClient):
    anna, ben, carla = (contact(client, name) for name in ("Anna", "Ben", "Carla"))
    family = group(client, "Familie", [anna, ben])
    body = {"name": "Familie", "member_ids": [carla["id"], anna["id"]]}
    response = client.put(f"{GROUPS}/{family['id']}", json=body)
    assert response.json()["member_ids"] == [carla["id"], anna["id"]]


def test_deleting_a_group_keeps_its_contacts(client: TestClient):
    anna = contact(client, "Anna")
    family = group(client, "Familie", [anna])
    assert client.delete(f"{GROUPS}/{family['id']}").status_code == 204
    assert [c["group_ids"] for c in client.get(CONTACTS).json()] == [[]]


def test_deleting_a_contact_keeps_the_invited_person(client: TestClient):
    anna = contact(client, "Anna")
    group(client, "Familie", [anna])
    event_id = event(client)
    body = {"name": "Anna", "persons": [{"name": "Anna", "contact_id": anna["id"]}]}
    client.post(f"{EVENTS}/{event_id}/invites", json=body)

    assert client.delete(f"{CONTACTS}/{anna['id']}").status_code == 204
    assert client.get(GROUPS).json()[0]["member_ids"] == []
    [invite] = client.get(f"{EVENTS}/{event_id}/invites").json()
    assert invite["persons"][0]["name"] == "Anna"
    assert invite["persons"][0]["contact_id"] is None  # SET NULL: the person stays (D9)


def test_address_books_are_private(client: TestClient, log_in_as):
    anna = contact(client, "Anna")
    family = group(client, "Familie", [anna])

    log_in_as("stranger@example.com")
    assert client.get(CONTACTS).json() == []
    assert client.get(GROUPS).json() == []
    assert client.put(f"{CONTACTS}/{anna['id']}", json={"name": "X"}).status_code == 404
    assert client.delete(f"{GROUPS}/{family['id']}").status_code == 404
    # Neither someone else's contact in an own group, nor joining someone else's group.
    assert client.post(GROUPS, json={"name": "X", "member_ids": [anna["id"]]}).status_code == 404
    body = {"name": "Mine", "group_ids": [family["id"]]}
    assert client.post(CONTACTS, json=body).status_code == 404


# Import


def test_import_creates_contacts_and_groups_from_labels(client: TestClient):
    existing = group(client, "Familie", [])
    body = {
        "contacts": [
            {"name": "Anna", "birth_year": 1990, "groups": ["familie", "Arbeit"]},
            {"name": "Ben", "groups": ["Arbeit", "Arbeit"]},
            {"name": "Carla"},
        ]
    }
    response = client.post(f"{CONTACTS}/import", json=body)
    assert response.status_code == 200, response.text
    assert response.json() == {"contacts": 3, "skipped": 0, "groups": 1}

    contacts = {c["name"]: c for c in client.get(CONTACTS).json()}
    groups = {g["name"]: g for g in client.get(GROUPS).json()}
    assert set(groups) == {"Familie", "Arbeit"}  # "familie" joined the existing group
    assert groups["Familie"]["id"] == existing["id"]
    assert groups["Familie"]["member_ids"] == [contacts["Anna"]["id"]]
    assert groups["Arbeit"]["member_ids"] == [contacts["Anna"]["id"], contacts["Ben"]["id"]]
    assert groups["Arbeit"]["invite_mode"] == "separately"  # labels are usually circles
    assert contacts["Anna"]["birth_year"] == 1990


def test_import_checks_its_input(client: TestClient):
    assert client.post(f"{CONTACTS}/import", json={"contacts": []}).status_code == 422
    body = {"contacts": [{"name": "Anna", "birth_year": 20}]}
    assert client.post(f"{CONTACTS}/import", json=body).status_code == 422


# Inviting contacts and groups


def test_invite_contacts(client: TestClient, log_in_as):
    anna = contact(client, "Anna")
    event_id = event(client)
    url = f"{EVENTS}/{event_id}/invites"

    body = {"name": "Anna", "persons": [{"name": "Anna", "contact_id": anna["id"]}]}
    response = client.post(url, json=body)
    assert response.status_code == 201, response.text
    assert response.json()["persons"][0]["contact_id"] == anna["id"]

    # At most once per event (D21), and not twice in one invite.
    again = client.post(url, json={"name": "Noch mal", "persons": body["persons"]})
    assert again.status_code == 409
    assert "Anna" in again.json()["detail"]
    twice = {"name": "X", "persons": [{"name": "A", "contact_id": anna["id"]}] * 2}
    assert client.post(f"{EVENTS}/{event(client)}/invites", json=twice).status_code == 422

    log_in_as("cohost@example.com", event_id, "admin")
    assert client.post(url, json={"name": "X", "persons": body["persons"]}).status_code == 404


def test_invite_a_group(client: TestClient):
    anna, ben = contact(client, "Anna"), contact(client, "Ben")
    family = group(client, "Familie Müller", [anna, ben])
    url = f"{EVENTS}/{event(client)}/invites/group"

    response = client.post(url, json={"group_id": family["id"]})
    assert response.status_code == 201, response.text
    [invite] = response.json()["invites"]
    assert invite["name"] == "Familie Müller"
    assert [p["name"] for p in invite["persons"]] == ["Anna", "Ben"]
    assert response.json()["skipped"] == []


def test_invite_a_group_one_link_each(client: TestClient):
    anna, ben, carla = (contact(client, name) for name in ("Anna", "Ben", "Carla"))
    friends = group(client, "Freunde", [anna, ben, carla])
    event_id = event(client)
    body = {"name": "Carla", "persons": [{"name": "Carla", "contact_id": carla["id"]}]}
    client.post(f"{EVENTS}/{event_id}/invites", json=body)

    url = f"{EVENTS}/{event_id}/invites/group"
    response = client.post(url, json={"group_id": friends["id"], "invite_mode": "separately"})
    assert response.status_code == 201, response.text
    assert [i["name"] for i in response.json()["invites"]] == ["Anna", "Ben"]
    assert response.json()["skipped"] == ["Carla"]

    again = client.post(url, json={"group_id": friends["id"]})
    assert again.status_code == 409


def test_invite_a_group_follows_the_group_setting(client: TestClient):
    anna, ben = contact(client, "Anna"), contact(client, "Ben")
    friends = group(client, "Freunde", [anna, ben], invite_mode="separately")
    url = f"{EVENTS}/{event(client)}/invites/group"
    response = client.post(url, json={"group_id": friends["id"]})
    assert len(response.json()["invites"]) == 2

    empty = group(client, "Leer", [])
    assert client.post(url, json={"group_id": empty["id"]}).status_code == 422


def test_inviting_a_group_needs_the_admin_role(client: TestClient, log_in_as):
    event_id = event(client)
    log_in_as("viewer@example.com", event_id, "viewer")
    anna = contact(client, "Anna")
    friends = group(client, "Freunde", [anna])
    url = f"{EVENTS}/{event_id}/invites/group"
    assert client.post(url, json={"group_id": friends["id"]}).status_code == 403


def test_contact_names_are_unique(client: TestClient):
    anna = client.post(CONTACTS, json={"name": "Anna"}).json()
    response = client.post(CONTACTS, json={"name": "anna"})
    assert response.status_code == 409
    ben = client.post(CONTACTS, json={"name": "Ben"}).json()
    assert client.put(f"{CONTACTS}/{ben['id']}", json={"name": "ANNA"}).status_code == 409
    # Saving a contact under its own name, or a new spelling of it, is fine.
    assert client.put(f"{CONTACTS}/{anna['id']}", json={"name": "Anna"}).status_code == 200
    assert client.put(f"{CONTACTS}/{anna['id']}", json={"name": "ANNA"}).status_code == 200


def test_import_skips_names_already_there(client: TestClient):
    client.post(CONTACTS, json={"name": "Anna"})
    body = {"contacts": [{"name": "anna"}, {"name": "Ben"}, {"name": "Ben"}]}
    result = client.post(f"{CONTACTS}/import", json=body).json()
    assert (result["contacts"], result["skipped"]) == (1, 2)
    assert sorted(c["name"] for c in client.get(CONTACTS).json()) == ["Anna", "Ben"]


def test_import_restores_declared_groups(client: TestClient):
    existing = group(client, "Tennis", [], invite_mode="together")
    body = {
        "contacts": [{"name": "Anna"}, {"name": "Ben"}, {"name": "Carla"}],
        "groups": [
            {"name": "Familie", "invite_mode": "together", "members": ["Carla", "Anna", "Nobody"]},
            {"name": "Tennis", "invite_mode": "separately", "members": ["Ben"]},  # exists
            {"name": "Leer", "invite_mode": "together"},  # nobody in it
        ],
    }
    response = client.post(f"{CONTACTS}/import", json=body)
    assert response.status_code == 200, response.text
    assert response.json() == {"contacts": 3, "skipped": 0, "groups": 2}  # Familie, Leer

    contacts = {c["name"]: c["id"] for c in client.get(CONTACTS).json()}
    groups = {g["name"]: g for g in client.get(GROUPS).json()}
    assert set(groups) == {"Familie", "Leer", "Tennis"}
    assert groups["Familie"]["invite_mode"] == "together"  # as declared
    assert groups["Familie"]["member_ids"] == [contacts["Carla"], contacts["Anna"]]  # in order
    assert groups["Leer"]["invite_mode"] == "together"
    assert groups["Leer"]["member_ids"] == []
    assert groups["Tennis"]["id"] == existing["id"]
    assert groups["Tennis"]["invite_mode"] == "together"  # the existing one keeps its setting
    assert groups["Tennis"]["member_ids"] == [contacts["Ben"]]


def test_import_declared_members_are_only_new_contacts(client: TestClient):
    anna = contact(client, "Anna")
    body = {
        "contacts": [{"name": "anna"}, {"name": "Ben"}],
        "groups": [{"name": "Familie", "members": ["Anna", "Ben"]}],
    }
    assert client.post(f"{CONTACTS}/import", json=body).json()["skipped"] == 1
    [familie] = client.get(GROUPS).json()
    assert anna["id"] not in familie["member_ids"]  # skipped: left as it was
    assert len(familie["member_ids"]) == 1


def test_import_checks_declared_groups(client: TestClient):
    body = {"contacts": [{"name": "Anna"}], "groups": [{"name": "X", "invite_mode": "all"}]}
    assert client.post(f"{CONTACTS}/import", json=body).status_code == 422
