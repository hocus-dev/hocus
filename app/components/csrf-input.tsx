export default function CsrfInput(props: { token: string }): JSX.Element {
  return <input type="hidden" name="_csrf" value={props.token} />;
}
