import { Button } from "flowbite-react";

export function PrebuildRetryButton(props: { prebuildExternalId: string }): JSX.Element {
  return (
    <Button className="transition-all" color="light">
      <i className="fa-solid fa-rotate-right mr-2"></i>
      <span>Retry</span>
    </Button>
  );
}
