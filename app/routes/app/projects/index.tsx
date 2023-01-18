import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Button } from "flowbite-react";
import { AppPage } from "~/components/app-page";
import NoProjectsView from "~/components/projects/no-projects-view";
import { ProjectList } from "~/components/projects/project-list";
import { PagePaths } from "~/page-paths.shared";

export const loader = async () => {
  const projects = Array.from({ length: 10 }).map((_, i) => ({
    externalId: `woop woop ${i}`,
    name: `My project ${i}`,
    repositoryUrl: "git@github.com:hocus-dev/hocus.git",
    lastUpdatedAt: Date.now() - 1000 * 60 * i,
  }));

  return json({
    projects,
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
