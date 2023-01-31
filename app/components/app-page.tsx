import React from "react";

import { GlobalContext } from "./global-context.shared";
import { Navbar } from "./navbar";
import { PageFooter } from "./page-footer";

export const AppPagePure = (props: {
  userEmail?: string;
  children?: React.ReactNode;
}): JSX.Element => {
  return (
    <div className="flex grow justify-center">
      <div className="flex flex-col grow max-w-7xl">
        <Navbar userEmail={props.userEmail} />
        <div className="px-2 sm:px-4 flex flex-col grow mb-4">{props.children}</div>
        <PageFooter />
      </div>
    </div>
  );
};

export const AppPage = (props: { children?: React.ReactNode }): JSX.Element => {
  const { userEmail } = React.useContext(GlobalContext);
  return <AppPagePure userEmail={userEmail ?? ""} children={props.children} />;
};
