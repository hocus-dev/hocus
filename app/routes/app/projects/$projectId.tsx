import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { StatusCodes } from "http-status-codes";
import path from "path-browserify";
import { AppPage } from "~/components/app-page";
import { HttpError } from "~/http-error";
import { UuidValidator } from "~/schema/uuid.validator.server";

export const loader = async ({ context: { db, req } }: LoaderArgs) => {
  const projectExternalId = UuidValidator.Parse(path.parse(req.params[0]).name);
  const project = await db.project.findUnique({ where: { externalId: projectExternalId } });
  if (project == null) {
    throw new HttpError(StatusCodes.NOT_FOUND, "Project not found");
  }

  return json({
    // projects: props,
  });
};

export default function ProjectRoute(): JSX.Element {
  // const { projects } = useLoaderData<typeof loader>();

  return (
    <AppPage>
      <div>this is the project route</div>
    </AppPage>
  );
}
