import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

setBaseUrl(import.meta.env.VITE_API_URL ?? "");

// Auth token getter is set by App.tsx once Clerk is initialized.
// Exported so ClerkProvider can register it after sign-in.
export { setAuthTokenGetter };

createRoot(document.getElementById("root")!).render(<App />);
