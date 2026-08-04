import { createRoot } from "react-dom/client";

import { LocaleProvider } from "./app/locale-context";
import { ReactApplication } from "./app/react-application";

import "./styles/styles.css";
import "./styles/workspace.css";
import "./styles/form-controls.css";
import "./styles/connection.css";
import "./styles/application-shell.css";
import "./styles/overlays.css";
import "./styles/control-plane.css";
import "./styles/artifact-management.css";
import "./styles/identity-management.css";
import "./styles/replication-management.css";
import "./styles/administration.css";
import "./styles/preheat-management.css";
import "./styles/execution-details.css";
import "./styles/registry-management.css";
import "./styles/security-management.css";
import "./styles/responsive.css";
import "./styles/spacing-system.css";
import "./styles/motion-system.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Harbor Console root element is missing");
createRoot(root).render(
  <LocaleProvider>
    <ReactApplication />
  </LocaleProvider>,
);
