import { Avatar, Dropdown, Navbar as FlowbiteNavbar } from "flowbite-react";
import { GlobalContext } from "~/components/global-context.shared";
import { PagePaths } from "~/page-paths.shared";

export const Navbar = (): JSX.Element => {
  return (
    <FlowbiteNavbar fluid={true} rounded={false}>
      <FlowbiteNavbar.Brand href="/">
        <img src="/logo-leaf.png" className="mr-3 h-6 sm:h-6" alt="Hocus Logo" />
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
          Hocus
        </span>
      </FlowbiteNavbar.Brand>
      <div className="flex md:order-2">
        <Dropdown
          arrowIcon={true}
          inline={true}
          label={<Avatar alt="User settings" color="white" rounded={true} />}
        >
          <Dropdown.Header>
            <GlobalContext.Consumer>
              {({ userEmail }) => (
                <span className="block truncate text-sm font-medium text-gray-400">
                  {userEmail}
                </span>
              )}
            </GlobalContext.Consumer>
          </Dropdown.Header>
          <a href={PagePaths.Settings}>
            <Dropdown.Item>Settings</Dropdown.Item>
          </a>
          <Dropdown.Divider />
          <form action={PagePaths.Logout} method="GET">
            <button className="w-full" type="submit">
              <Dropdown.Item>Sign out</Dropdown.Item>
            </button>
          </form>
        </Dropdown>
      </div>
    </FlowbiteNavbar>
  );
};
