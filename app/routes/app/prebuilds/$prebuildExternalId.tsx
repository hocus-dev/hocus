import path from "path";

import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { StatusCodes } from "http-status-codes";
import { AppPage } from "~/components/app-page";
import { BackToProjectLink } from "~/components/projects/back-to-project-link";
import { HttpError } from "~/http-error.server";
import { ProjectPathTabId } from "~/page-paths.shared";
import { UuidValidator } from "~/schema/uuid.validator.server";

export const loader = async ({ context: { db, req } }: LoaderArgs) => {
  const { success, value: prebuildExternalId } = UuidValidator.SafeParse(
    path.parse(req.params[0]).name,
  );
  if (!success) {
    throw new HttpError(StatusCodes.BAD_REQUEST, "Prebuild id must be a UUID");
  }
  const prebuildEvent = await db.prebuildEvent.findUnique({
    where: {
      externalId: prebuildExternalId,
    },
    include: {
      project: true,
    },
  });
  if (prebuildEvent == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Prebuild not found");
  }
  return json({
    project: {
      name: prebuildEvent.project.name,
      externalId: prebuildEvent.project.externalId,
    },
  });
};

export default function PrebuildRoute(): JSX.Element {
  const { project } = useLoaderData<typeof loader>();

  return (
    <AppPage>
      <BackToProjectLink project={project} tabId={ProjectPathTabId.PREBUILDS} />

      <h1 className="font-bold text-3xl mt-4">Prebuild</h1>
      <div className="grid grid-cols-2 gap-16 mt-4 max-w-xl">
        <div className="grid grid-cols-3 gap-4">
          <h3 className="text-gray-400 col-span-1">Branch:</h3>
          <p className="font-bold col-span-2">refs/heads/main</p>
          <h3 className="text-gray-400 col-span-1">Commit:</h3>
          <p className="font-bold col-span-2">a1b2c3d</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <h3 className="text-gray-400 col-span-1">Created:</h3>
          <p className="font-bold col-span-2">28 minutes ago</p>
          <h3 className="text-gray-400 col-span-1">Status:</h3>
          <p className="font-bold col-span-2">
            <span className="text-blue-500">
              <i className="fa-solid fa-circle-play mr-2"></i>
              <span className="font-bold">Running</span>
            </span>
          </p>
        </div>
      </div>
      <div className="w-full mt-6 rounded-lg border border-gray-700">
        <div className="h-[30rem] flex">
          <div className="w-56 h-full border-r border-gray-700 shrink-0">
            <h1 className="h-16 font-bold text-lg p-4 border-b border-gray-700 flex flex-col justify-center">
              <span>Tasks</span>
            </h1>
            {["npm install", `echo "ok" | test`, "cargo install"].map((task, idx) => (
              <button
                key={idx}
                className="transition-all text-left w-full font-mono text-sm text-gray-400 p-4 border-b border-gray-700 hover:bg-gray-700 hover:text-white whitespace-nowrap truncate"
              >
                {task}
              </button>
            ))}
          </div>
          <div className="h-full grow flex flex-col">
            <div className="h-16 font-mono text-sm p-4 border-b border-gray-700 flex flex-col justify-center">
              <span>npm install</span>
            </div>
            <div className="grow bg-gray-900 rounded-br-lg font-mono p-6 text-sm overflow-auto">
              <p>
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
                veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam
                voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur
                magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est,
                qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non
                numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat
                voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
                suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum
                iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur,
                vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppPage>
  );
}
