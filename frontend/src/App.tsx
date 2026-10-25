import { EventList } from "./features/admin/EventList";

// Routing by hand while there are only a few pages; full page loads between them are fine.
export function App() {
  return <EventList />;
}
