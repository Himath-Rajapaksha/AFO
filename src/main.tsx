import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Hide the loading animation after React mounts
declare global {
  interface Window {
    __AFO_HIDE_LOADER?: () => void;
  }
}
window.__AFO_HIDE_LOADER?.();
