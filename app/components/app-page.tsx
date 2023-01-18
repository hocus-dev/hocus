import React from "react";

import { Navbar } from "./navbar";
import { PageFooter } from "./page-footer";

export const AppPage = (props: { children: React.ReactNode }): JSX.Element => {
  return (
    <div className="flex grow justify-center">
      <div className="flex flex-col grow max-w-7xl">
        <Navbar />
        <div className="px-2 sm:px-4 flex flex-col grow mb-4">{props.children}</div>
        <PageFooter />
      </div>
    </div>
  );
};
