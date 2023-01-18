import { GlobalContext } from "./global-context.shared";

export function CsrfInputWithProps(props: { token: string }): JSX.Element {
  return <input type="hidden" name="_csrf" value={props.token} />;
}

export function CsrfInput(): JSX.Element {
  return (
    <GlobalContext.Consumer>
      {({ csrfToken }) => <CsrfInputWithProps token={csrfToken} />}
    </GlobalContext.Consumer>
  );
}
