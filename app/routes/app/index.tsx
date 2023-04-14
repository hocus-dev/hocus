import { Button } from "flowbite-react";

import { AppPage } from "~/components/app-page";
import { GlobalContext } from "~/components/global-context.shared";

export default function AppIndex(): JSX.Element {
  return (
    <AppPage>
      <GlobalContext.Consumer>
        {({ gaUserId, csrfToken, userEmail }) => (
          <>
            <p>{`Your email is ${userEmail},`}</p>
            <p>{`GA userId is ${gaUserId},`}</p>
            <p>{`and the csrfToken is ${csrfToken}.`}</p>
          </>
        )}
      </GlobalContext.Consumer>
      <form action="/app/logout" method="GET">
        <Button outline={true} type="submit">
          Sign out
        </Button>
      </form>
    </AppPage>
  );
}
