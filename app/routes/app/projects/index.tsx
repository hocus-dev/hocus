import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Button } from "flowbite-react";
import { AppPage } from "~/components/app-page";
import NoProjectsView from "~/components/projects/no-projects-view";
import { ProjectList } from "~/components/projects/project-list";
import { PagePaths } from "~/page-paths.shared";
import { numericSort } from "~/utils.shared";

export const loader = async ({ context: { db } }: LoaderArgs) => {
  const projects = await db.project.findMany({ include: { gitRepository: true } });
  const props = projects.map((project) => ({
    externalId: project.externalId,
    name: project.name,
    repositoryUrl: project.gitRepository.url,
    createdAt: project.createdAt.getTime(),
  }));
  props.sort((a, b) => numericSort(b.createdAt, a.createdAt));

  return json({
    projects: props,
  });
};

export default function ProjectsRoute(): JSX.Element {
  const { projects } = useLoaderData<typeof loader>();

  return (
    <AppPage>
      <div className="mt-8 mb-4 flex justify-between items-end">
        <h1 className="text-4xl font-bold">Projects</h1>
        <Button href={PagePaths.NewProject} color="success" className="transition-all">
          <i className="fa-solid fa-file-circle-plus mr-2"></i>
          <span>New Project</span>
        </Button>
      </div>
      <hr className="bg-gray-600 border-gray-600 mb-8" />

      {projects.length > 0 ? <ProjectList elements={projects} /> : <NoProjectsView />}
    </AppPage>
  );
}
