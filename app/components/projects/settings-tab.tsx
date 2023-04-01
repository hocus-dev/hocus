import { Button } from "flowbite-react";
import React from "react";
import { MAX_REPOSITORY_DRIVE_SIZE_MIB } from "~/constants.shared";

import { TextInputAddonRight } from "../text-input-addon-right";

function InputFieldComponent<T extends string | number>(props: {
  title: string;
  inputName: string;
  initialValue: T;
  value: T;
  unit: string;
  size?: string;
  onChange?: (value: T) => void;
}): JSX.Element {
  return (
    <div className="flex flex-col justify-between">
      <h3 className="text-sm text-gray-400 mb-2">{props.title}</h3>
      <TextInputAddonRight
        inputExtraClassName={`max-w-[${props.size ?? "6rem"}]`}
        value={props.value}
        addon={<span>{props.unit}</span>}
      />
    </div>
  );
}

const InputField = React.memo(InputFieldComponent);

function SettingsTabComponent(_props: { maxPrebuildRamMib: number }): JSX.Element {
  return (
    <form>
      <div className="flex flex-col gap-4">
        <h1 className="font-bold text-xl mb-4">Project Settings</h1>
        <div>
          <h2 className="font-bold text-lg mb-2">Prebuild Limits</h2>
          <div className="flex gap-4">
            <InputField
              title="Virtual CPU Cores"
              inputName="prebuildVCPU"
              initialValue={4}
              value={4}
              unit="VCPU"
            />
            <InputField
              title="RAM"
              inputName="workspaceRam"
              initialValue={4096}
              value={4096}
              unit="MiB"
            />
            <InputField
              title="Max Root Filesystem Size"
              inputName="workspaceRootSize"
              initialValue={10000}
              value={10000}
              unit="MiB"
              size={"10rem"}
            />
            <div className="flex flex-col justify-between">
              <h3 className="text-sm text-gray-400 mb-2">Max Project Filesystem Size</h3>
              <TextInputAddonRight
                inputExtraClassName="max-w-[10rem]"
                disabled={true}
                value={MAX_REPOSITORY_DRIVE_SIZE_MIB}
                addon={<span>MiB</span>}
              />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Resources available to a virtual machine running a prebuild. Increasing filesystem size
            will lengthen prebuild times. You should change it if your workspace image is too large.
          </p>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2 mt-4">Workspace Limits</h2>
          <div className="flex gap-4">
            <InputField
              title="Virtual CPU Cores"
              inputName="prebuildVCPU"
              initialValue={8}
              value={8}
              unit="VCPU"
            />
            <InputField
              title="RAM"
              inputName="workspaceRam"
              initialValue={16192}
              value={16192}
              unit="MiB"
            />
            <InputField
              title="Max Root Filesystem Size"
              inputName="workspaceRootSize"
              initialValue={250000}
              value={250000}
              unit="MiB"
              size={"10rem"}
            />
            <InputField
              title="Max Root Project Size"
              inputName="workspaceRootSize"
              initialValue={250000}
              value={250000}
              unit="MiB"
              size={"10rem"}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Resources available inside a workspace.
          </p>
        </div>
        <div className="border-t border-gray-700"></div>

        <div className="flex justify-end">
          <Button className="w-fit" type="submit" color="success">
            <i className="fa-solid fa-floppy-disk mr-2"></i>
            <span>Save Changes</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

export const SettingsTab = React.memo(SettingsTabComponent);
