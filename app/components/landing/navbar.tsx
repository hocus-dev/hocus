import { Button, Navbar } from "flowbite-react";

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
        <Button gradientDuoTone="cyanToBlue">Use Hocus</Button>
      </div>
    </Navbar>
  );
};
