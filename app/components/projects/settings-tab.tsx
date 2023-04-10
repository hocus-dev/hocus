import type { Project } from "@prisma/client";
import { Button } from "flowbite-react";
import React from "react";
import type { Any } from "ts-toolbelt";
import { MAX_REPOSITORY_DRIVE_SIZE_MIB } from "~/constants.shared";

import { TextInputAddonRight } from "../text-input-addon-right";

import type { valueof } from "~/types/utils";

function InputFieldComponent(props: {
  title: React.ReactNode;
  unit: string;
  inputName: string;
  initialValue: number;
  inputExtraClassName?: string;
  inputProps?: React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >;
}): JSX.Element {
  const [value, setValue] = React.useState(props.initialValue);
  const onChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.validity.valid) {
      setValue(Number(e.currentTarget.value));
    }
  }, []);
  return (
    <div className="flex flex-col justify-end">
      <h3 className="text-sm text-gray-400 mb-2">{props.title}</h3>
      <TextInputAddonRight
        inputExtraClassName={props.inputExtraClassName ?? "max-w-[6rem]"}
        inputProps={{
          ...props.inputProps,
          value,
          name: props.inputName,
          type: "number",
          onChange,
        }}
        addon={<span>{props.unit}</span>}
      />
    </div>
  );
}

const InputField = React.memo(InputFieldComponent);

export type VmSettingsField = valueof<typeof VmSettingsField>;
export const VmSettingsField = {
  maxPrebuildRamMib: "maxPrebuildRamMib",
  maxPrebuildVCPUCount: "maxPrebuildVCPUCount",
  maxWorkspaceRamMib: "maxWorkspaceRamMib",
  maxWorkspaceVCPUCount: "maxWorkspaceVCPUCount",
  maxWorkspaceProjectDriveSizeMib: "maxWorkspaceProjectDriveSizeMib",
  maxWorkspaceRootDriveSizeMib: "maxWorkspaceRootDriveSizeMib",
  maxPrebuildRootDriveSizeMib: "maxPrebuildRootDriveSizeMib",
} as const;

type VmSettings = {
  [key in VmSettingsField]: number;
};

// enforce that VmSettingsField is a subset of Project fields
const _typecheck: Any.Contains<VmSettingsField, keyof Project> = 1;

function SettingsTabComponent(props: VmSettings): JSX.Element {
  const vmSettings = props;

  return (
    <form>
      <div className="flex flex-col gap-4">
        <h1 className="font-bold text-xl mb-4">Project Settings</h1>
        <div>
          <h2 className="font-bold text-lg mb-2">Prebuild Limits</h2>
          <div className="flex gap-4">
            <InputField
              title="Virtual CPU Cores"
              inputProps={{
                min: 1,
              }}
              unit="VCPU"
              inputExtraClassName="max-w-[5rem]"
              inputName={VmSettingsField.maxPrebuildVCPUCount}
              initialValue={vmSettings.maxPrebuildVCPUCount}
            />
            <InputField
              title="RAM"
              inputProps={{
                min: 1,
              }}
              unit="MiB"
              inputName={VmSettingsField.maxPrebuildRamMib}
              initialValue={vmSettings.maxPrebuildRamMib}
            />
            <InputField
              title="Max Root Filesystem Size"
              inputProps={{
                min: 1,
              }}
              unit="MiB"
              inputExtraClassName="max-w-[10rem]"
              inputName={VmSettingsField.maxPrebuildRootDriveSizeMib}
              initialValue={vmSettings.maxPrebuildRootDriveSizeMib}
            />
            <div className="flex flex-col justify-end">
              <h3 className="text-sm text-gray-400 mb-2">Max Project Filesystem Size</h3>
              <TextInputAddonRight
                inputExtraClassName="max-w-[10rem]"
                inputProps={{ disabled: true, value: MAX_REPOSITORY_DRIVE_SIZE_MIB }}
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
              inputProps={{
                min: 1,
              }}
              unit="VCPU"
              inputExtraClassName="max-w-[5rem]"
              inputName={VmSettingsField.maxWorkspaceVCPUCount}
              initialValue={vmSettings.maxWorkspaceVCPUCount}
            />
            <InputField
              title="RAM"
              inputProps={{
                min: 1,
              }}
              unit="MiB"
              inputName={VmSettingsField.maxWorkspaceRamMib}
              initialValue={vmSettings.maxWorkspaceRamMib}
            />
            <InputField
              title="Max Root Filesystem Size"
              inputProps={{
                min: 1,
              }}
              unit="MiB"
              inputExtraClassName="max-w-[10rem]"
              inputName={VmSettingsField.maxWorkspaceRootDriveSizeMib}
              initialValue={vmSettings.maxWorkspaceRootDriveSizeMib}
            />
            <InputField
              title="Max Root Project Size"
              inputProps={{
                min: 1,
              }}
              unit="MiB"
              inputExtraClassName="max-w-[10rem]"
              inputName={VmSettingsField.maxWorkspaceProjectDriveSizeMib}
              initialValue={vmSettings.maxWorkspaceProjectDriveSizeMib}
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
