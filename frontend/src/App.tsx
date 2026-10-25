import { EventList } from "./features/admin/EventList";
import { EventPage } from "./features/admin/EventPage";
import { GuestPage } from "./features/guest/GuestPage";

// Routing by hand while there are only a few pages; full page loads between them are fine (A18).
export function App() {
  const path = window.location.pathname;

  const guest = path.match(/^\/i\/([^/]+)\/?$/);
  if (guest?.[1]) return <GuestPage token={decodeURIComponent(guest[1])} />;

  const event = path.match(/^\/admin\/events\/([^/]+)\/?$/);
  if (event?.[1]) return <EventPage eventId={event[1]} />;

  return <EventList />;
}
