import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./i18n";
import "./styles.css";

// Pages are full loads (A18), so "back" can bring up the page as it was left, with its state, and
// without loading it again: it wouldn't know about a setting changed meanwhile (all that's kept in
// the storage is settings). Only then is it loaded anew.
const settings = () => {
  try {
    return JSON.stringify(Object.entries(localStorage));
  } catch {
    return ""; // Storage is blocked: nothing can have changed.
  }
};
const settingsAtLoad = settings();
window.addEventListener("pageshow", (e) => {
  if (e.persisted && settings() !== settingsAtLoad) window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
