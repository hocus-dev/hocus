import { Button, Navbar } from "flowbite-react";
import { LOGIN_URL } from "~/routes/app/sign-in/login-redirect.constant";

export const LandingNavbar = (): JSX.Element => {
  return (
    <Navbar fluid={true} rounded={false}>
      <Navbar.Brand href="https://flowbite.com/">
        <img src="/logo-leaf.png" className="mr-3 h-6 sm:h-6" alt="Hocus Logo" />
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
          Hocus
        </span>
      </Navbar.Brand>
      <div className="flex md:order-2">
        <form action={LOGIN_URL} method="GET">
          <Button type="submit" gradientDuoTone="cyanToBlue">
            Use Hocus
          </Button>
        </form>
      </div>
    </Navbar>
  );
};
