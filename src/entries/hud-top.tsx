import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { HudTop } from "../views/HudTop";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudTop />
  </StrictMode>
);
