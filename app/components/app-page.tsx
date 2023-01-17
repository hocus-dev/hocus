import React from "react";

import { Navbar } from "./navbar";

export const AppPage = (props: { children: React.ReactNode }): JSX.Element => {
  return (
    <>
      <Navbar />
      {props.children}
    </>
  );
};
