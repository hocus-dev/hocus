import { Button, TextInput } from "flowbite-react";

export const EnvironmentTab = (): JSX.Element => {
  const mockValues = [
    ["FOO", "bar", true],
    ["BAR", "baz", false],
    ["BAZ", "foo", false],
  ] as const;
  const gridStr = "grid grid-cols-[20rem_minmax(0,_1fr)_3rem]";
  return (
    <div>
      <div>
        <h1 className="font-bold text-xl">Project Level</h1>
        <p className="mt-2 text-gray-400">
          Project-level environment variables are available to all project members. They are also
          accessible during prebuilds.
        </p>
        <div className="mt-4">
          <div className={`${gridStr} gap-x-4 mb-2`}>
            <h3 className="text-gray-400">Name</h3>
            <h3 className="text-gray-400">Value</h3>
            <div></div>
          </div>
          {mockValues.map(([name, value, edited], idx) => (
            <div className={`${gridStr} gap-4 mb-4`} key={idx}>
              <TextInput className="font-mono" type="text" defaultValue={name} />
              <div className="flex">
                <TextInput className="font-mono grow" type="text" defaultValue={value} />
                {edited && (
                  <div className="h-full flex justify-center items-center ml-4">
                    <Button
                      aria-label="reset variable"
                      color="light"
                      className="min-h-full transition-all"
                    >
                      <i className="fa-solid fa-eraser"></i>
                    </Button>
                  </div>
                )}
              </div>
              <Button
                aria-label="delete variable"
                color="failure"
                className="min-h-full transition-all"
              >
                <i className="fa-solid fa-trash"></i>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
