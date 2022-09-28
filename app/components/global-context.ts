import React from "react";

export const GlobalContext = React.createContext<{
  csrfToken: string;
  gaUserId: string | undefined;
  userEmail: string | undefined;
}>({ csrfToken: "", gaUserId: void 0, userEmail: void 0 });
