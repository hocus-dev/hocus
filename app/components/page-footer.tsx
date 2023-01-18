import { Footer } from "flowbite-react";

export const PageFooter = (): JSX.Element => {
  return (
    <div className="px-2 mb-8 ">
      <div className="w-full">
        <Footer.Divider />
        <div className="w-full sm:flex sm:items-center sm:justify-between">
          <a href="https://hocus.dev" target="_blank noreferrer noopener">
            <span className="text-sm text-gray-400 sm:text-center hover:text-gray-200">
              © 2023<span className="ml-1">hocus.dev</span>
            </span>
          </a>
          <div className="mt-4 flex space-x-6 sm:mt-0 sm:justify-center">
            <a
              className="text-2xl text-gray-400 hover:text-gray-200 transition-all"
              href="https://github.com/hocus-dev/hocus"
              target="_blank noreferrer noopener"
            >
              <i className="fa-brands fa-github"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
