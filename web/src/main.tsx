import { createRoot } from "react-dom/client";

import { LocaleProvider } from "./app/locale-context";
import { ReactApplication } from "./app/react-application";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/page.css";
import "./styles/controls.css";
import "./styles/collections.css";
import "./styles/feedback.css";
import "./styles/dialogs.css";
import "./styles/logs.css";
import "./features/about/about.css";
import "./features/administration/administration.css";
import "./features/artifacts/artifacts.css";
import "./features/audit/audit.css";
import "./features/auth/auth.css";
import "./features/overview/overview.css";
import "./features/preheat/preheat.css";
import "./features/projects/projects.css";
import "./features/registries/registries.css";
import "./features/replication/replication.css";
import "./features/security/security.css";
import "./features/system/system.css";
import "./styles/motion.css";

const root = document.querySelector<HTMLElement>("#root");
if (!root) throw new Error("Harbor Console root element is missing");
createRoot(root).render(
  <LocaleProvider>
    <ReactApplication />
  </LocaleProvider>,
);
