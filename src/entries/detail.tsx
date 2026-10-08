import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { HudDetail } from "../views/HudDetail";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudDetail />
  </StrictMode>
);
