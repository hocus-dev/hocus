import { Button } from "flowbite-react";

export const LandingHero = (): JSX.Element => {
  return (
    <div className="flex flex-col text-center items-center justify-center mt-20 mb-14 mx-4">
      <h1 className="text-white text-5xl font-bold">{"Finish your test suite in < 1 min"}</h1>
      <div className="w-[32rem]">
        <h3 className="mt-6 text-slate-300 text-3xl font-light">
          Run all tests at once. <br />
          Use any programming language and any framework.
        </h3>
      </div>

      <div className="flex align-center justify-center space-x-4 mt-12">
        <Button size="lg" gradientDuoTone="cyanToBlue">
          <span className="w-32">Use Hocus</span>
        </Button>
        <Button size="lg" color="light">
          <span className="w-32">Read the docs</span>
        </Button>
      </div>
    </div>
  );
};
