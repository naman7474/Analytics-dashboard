"use client";

import { createContext, useContext } from "react";
import { AppRole } from "../types";

interface UserContextValue {
  role: AppRole;
}

export const UserContext = createContext<UserContextValue>({
  role: "viewer",
});

export function useUser() {
  return useContext(UserContext);
}
