import { EventList } from "./features/admin/EventList";
import { AddressBook } from "./features/contacts/AddressBook";
import { EventPage } from "./features/admin/EventPage";
import { EventSetup } from "./features/admin/EventSetup";
import { NewEvent } from "./features/admin/NewEvent";
import { GuestPage } from "./features/guest/GuestPage";

// Routing by hand while there are only a few pages; full page loads between them are fine (A18).
export function App() {
  const path = window.location.pathname;

  const guest = path.match(/^\/i\/([^/]+)\/?$/);
  if (guest?.[1]) return <GuestPage token={decodeURIComponent(guest[1])} />;

  if (/^\/admin\/contacts\/?$/.test(path)) return <AddressBook />;

  if (/^\/admin\/events\/new\/?$/.test(path)) return <NewEvent />;

  const setup = path.match(/^\/admin\/events\/([^/]+)\/edit\/?$/);
  if (setup?.[1]) return <EventSetup eventId={setup[1]} />;

  const event = path.match(/^\/admin\/events\/([^/]+)\/?$/);
  if (event?.[1]) return <EventPage eventId={event[1]} />;

  return <EventList />;
}
