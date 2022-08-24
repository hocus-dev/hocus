import { Navbar, Button, Toast } from "flowbite-react";

export default function Flow() {
  return (
    <>
      <Navbar fluid={true} rounded={false}>
        <Navbar.Brand href="https://flowbite.com/">
          <img
            src="https://flowbite.com/docs/images/logo.svg"
            className="mr-3 h-6 sm:h-9"
            alt="Flowbite Logo"
          />
          <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
            Flowbite
          </span>
        </Navbar.Brand>
        <div className="flex md:order-2">
          <Button>Get started</Button>
          <Navbar.Toggle />
        </div>
        <Navbar.Collapse>
          <Navbar.Link href="/navbars" active={true}>
            Home
          </Navbar.Link>
          <Navbar.Link href="/navbars">About</Navbar.Link>
          <Navbar.Link href="/navbars">Services</Navbar.Link>
          <Navbar.Link href="/navbars">Pricing</Navbar.Link>
          <Navbar.Link href="/navbars">Contact</Navbar.Link>
        </Navbar.Collapse>
      </Navbar>
      <div className="space-x-4 divide-x divide-gray-200 dark:divide-gray-700">
        <Toast>
          {/* <FaTelegramPlane className="h-5 w-5 text-blue-600 dark:text-blue-500" /> */}
          <div className="pl-4 text-sm font-normal">Message sent successfully.</div>
        </Toast>
      </div>
    </>
  );
}
