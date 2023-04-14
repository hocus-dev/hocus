import { Avatar, Dropdown, Navbar as FlowbiteNavbar } from "flowbite-react";
import React from "react";

import { PagePaths } from "~/page-paths.shared";

const NavbarComponent = (props: { userEmail?: string }): JSX.Element => {
  return (
    <FlowbiteNavbar fluid={true} rounded={false}>
      <FlowbiteNavbar.Brand href={PagePaths.ProjectList}>
        <img src="/logo-leaf.png" className="mr-3 h-6 sm:h-6" alt="Hocus Logo" />
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
          Hocus
        </span>
      </FlowbiteNavbar.Brand>
      <div className="flex items-center gap-8 md:order-2">
        <a
          target="_blank"
          rel="noreferrer"
          href="https://hocus.dev/docs/installation/troubleshooting"
          className="text-sm text-gray-400 hover:text-gray-200 transition-all"
        >
          <i className="fa-solid fa-wrench mr-2"></i>
          <span>Troubleshooting</span>
        </a>
        <Dropdown
          arrowIcon={true}
          inline={true}
          label={
            <div className="opacity-[0.8]">
              <Avatar alt="User settings" color="white" rounded={true} img="/user-icon.jpg" />
            </div>
          }
        >
          {props.userEmail && (
            <Dropdown.Header>
              <span className="block truncate text-sm font-medium text-gray-400">
                <i className="fa-solid fa-envelope mr-2"></i>
                <span>{props.userEmail}</span>
              </span>
            </Dropdown.Header>
          )}
          <a href={PagePaths.UserSettings}>
            <Dropdown.Item>
              <i className="fa-solid fa-gear mr-2"></i>
              <span>Settings</span>
            </Dropdown.Item>
          </a>
          <Dropdown.Divider />
          <form action={PagePaths.Logout} method="GET">
            <button className="w-full" type="submit">
              <Dropdown.Item>
                <i className="fa-solid fa-right-from-bracket mr-2"></i>
                <span>Sign out</span>
              </Dropdown.Item>
            </button>
          </form>
        </Dropdown>
      </div>
    </FlowbiteNavbar>
  );
};

export const Navbar = React.memo(NavbarComponent);
