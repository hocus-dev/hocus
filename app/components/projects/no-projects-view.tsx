import { Button, Card } from "flowbite-react";

export default function NoProjectsView(): JSX.Element {
  return (
    <div className="w-full flex flex-col justify-center grow">
      <div className="flex justify-center">
        <a href="xd" className="max-w-md hover:drop-shadow-xl hover:scale-[1.03] transition-all">
          <Card>
            <div className="py-6 text-center">
              <h5 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
                No projects yet.
              </h5>
              <p className="mb-8 text-base text-gray-500 dark:text-gray-400 sm:text-lg">
                When you add a project, it will show up here.
              </p>
              <div className="w-full flex justify-center">
                <Button color="success">Create your first project</Button>
              </div>
            </div>
          </Card>
        </a>
      </div>
    </div>
  );
}
