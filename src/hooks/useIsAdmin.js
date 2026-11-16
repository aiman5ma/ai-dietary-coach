import { useEffect, useState } from "react";

import { adminWhoami } from "../api/adminClient.js";
import { useAuth } from "../context/AuthContext.jsx";

export function useIsAdmin() {
  const { session } = useAuth();
  const token = session?.access_token || "";
  const [state, setState] = useState({ token: "", isAdmin: false });

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    adminWhoami(token)
      .then((value) => {
        if (active) setState({ token, isAdmin: value === true });
      })
      .catch(() => {
        if (active) setState({ token, isAdmin: false });
      });
    return () => {
      active = false;
    };
  }, [token]);

  return state.token === token && state.isAdmin;
}
