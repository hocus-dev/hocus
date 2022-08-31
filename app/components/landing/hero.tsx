import { Button } from "flowbite-react";
import { LOGIN_URL } from "~/routes/app/sign-in/login-redirect.constant";

export const LandingHero = (): JSX.Element => {
  return (
    <div className="flex flex-col w-100 text-center items-center justify-center mt-20 mb-14 mx-4">
      <h1 className="text-white text-4xl md:text-5xl font-bold">
        {"Finish your test suite in < 1 min"}
      </h1>
      <div className="w-[32rem] max-w-full">
        <h3 className="mt-6 text-slate-300 text-xl md:text-2xl font-light">
          Run all tests at once. <br />
          Use any programming language and framework.
        </h3>
      </div>

      <div className="flex w-full justify-center space-x-4 mt-12">
        <form action={LOGIN_URL} method="GET">
          <Button type="submit" size="lg" gradientDuoTone="cyanToBlue">
            <span className="w-28">Use Hocus</span>
          </Button>
        </form>
        <Button size="lg" color="light">
          <span className="w-28">Read the docs</span>
        </Button>
      </div>
    </div>
  );
};
