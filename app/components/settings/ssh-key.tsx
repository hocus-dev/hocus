import { Button } from "flowbite-react";

export const SshKey = (props: { name: string; publicKey: string }): JSX.Element => {
  return (
    <div>
      <div className="mb-2 flex gap-4 justify-between items-center">
        <h3 className="font-bold mr-2">{props.name}</h3>
        <Button size="xs" color="dark">
          <i className="fa-solid fa-trash mr-2"></i>
          <span>Delete</span>
        </Button>
      </div>
      <p className="font-mono text-sm text-gray-300 p-2 border border-gray-700 bg-gray-700 rounded-lg">
        {props.publicKey}
      </p>
    </div>
  );
};
