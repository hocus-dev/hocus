import type { WorkspaceStatus } from "@prisma/client";
import { Button } from "flowbite-react";
import moment from "moment";

export interface WorkspaceListElementProps {
  externalId: string;
  name: string;
  /** Timestamp in milliseconds. */
  lastOpenedAt: number;
  /** Timestamp in milliseconds. */
  createdAt: number;
  status: WorkspaceStatus;
}

export function WorkspaceListElement(props: WorkspaceListElementProps): JSX.Element {
  const created = moment(props.createdAt).fromNow();
  return (
    <div className="w-full flex justify-between pb-4 pt-4 first:pt-0 first:-mt-1 border-gray-700 border-b-[1px]">
      <div className="grid grid-cols-2 grid-rows-2 gap-4 mr-4">
        <p className="text-gray-400">
          <span className="mr-1">Status: </span>
        </p>
        {[
          ["Created", created],
          ["Name", props.name],
        ].map(([title, content], idx) => (
          <p key={idx} className="text-gray-400">
            <span>{title}: </span>
            <span className="font-bold text-white">{content}</span>
          </p>
        ))}
      </div>
      <div className="flex flex-col justify-center">
        <div className="flex gap-4">
          <Button color="light" className="transition-all">
            <i className="fa-solid fa-circle-info mr-2"></i>
            <span>Details</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
