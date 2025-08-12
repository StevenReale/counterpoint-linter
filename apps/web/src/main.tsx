import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

console.log("main.tsx loaded"); // quick sanity check

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
