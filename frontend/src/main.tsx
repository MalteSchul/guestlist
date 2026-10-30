import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./i18n";
import "./styles.css";

// Pages are full loads (A18), so "back" can bring up the page as it was left, with its state, and
// without loading it again: it wouldn't know about a setting changed meanwhile. Load it anew.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
