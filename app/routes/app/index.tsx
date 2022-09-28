import { Button } from "flowbite-react";
import { GlobalContext } from "~/components/global-context";

export default function AppIndex(): JSX.Element {
  return (
    <div>
      <GlobalContext.Consumer>
        {({ gaUserId, csrfToken }) => (
          <p>{`Your GA userId is ${gaUserId}, and the csrfToken is ${csrfToken}`}</p>
        )}
      </GlobalContext.Consumer>
      <form action="/app/logout" method="GET">
        <Button outline={true} type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
