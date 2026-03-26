import { Navigate } from "react-router-dom";

// Index just redirects — role-based routing happens in App.tsx
export default function Index() {
  return <Navigate to="/" replace />;
}
