import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { HudCrew } from "../views/HudCrew";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudCrew />
  </StrictMode>
);
