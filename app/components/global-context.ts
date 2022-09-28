import React from "react";

export const GlobalContext = React.createContext<{
  csrfToken: string;
  gaUserId: string | undefined;
}>({ csrfToken: "", gaUserId: void 0 });
