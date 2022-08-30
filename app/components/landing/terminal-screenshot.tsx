export const TerminalScreenshot = (): JSX.Element => {
  return (
    <>
      <div className="flex justify-center text-center w-full mt-14 sm:mt-28">
        <div className="w-full relative">
          <div className="w-full flex justify-center">
            <div className="w-[50rem] relative">
              <img
                src="/landing-page/hocus-terminal-screenshot.png"
                className="w-full"
                alt="Hocus terminal screenshot"
              />
              <img
                src="/landing-page/left-leaf.png"
                className="absolute top-0 -left-[16rem] sm:-left-[12rem] w-96 h-96 -z-20"
                alt="Left leaf"
              />
              <img
                src="/landing-page/right-leaf.png"
                className="absolute top-0 -right-[16rem] sm:-right-[12rem] w-96 h-96 -z-20"
                alt="Right leaf"
              />
            </div>
          </div>
          <div className="absolute w-screen h-[25rem] top-[8rem] sm:top-[14rem] bg-gray-700 -z-10"></div>
        </div>
      </div>
    </>
  );
};
