import type { Project } from "@prisma/client";
import { Button } from "flowbite-react";
import React from "react";
import type { Any } from "ts-toolbelt";
import { MAX_REPOSITORY_DRIVE_SIZE_MIB } from "~/constants.shared";

import { TextInputAddonRight } from "../text-input-addon-right";

const VmSettingsFields = [
  "maxPrebuildRamMib",
  "maxPrebuildVCPUCount",
  "maxWorkspaceRamMib",
  "maxWorkspaceVCPUCount",
  "maxWorkspaceProjectDriveSizeMib",
  "maxWorkspaceRootDriveSizeMib",
  "maxPrebuildRootDriveSizeMib",
] as const;

export type VmSettingsField = typeof VmSettingsFields[number];
// enforce that VmSettingsField is a subset of Project fields
const _typecheck: Any.Contains<VmSettingsField, keyof Project> = 1;

export const VmSettingsField = Object.fromEntries(
  VmSettingsFields.map((field) => [field, field]),
) as { [key in VmSettingsField]: key };

type InputContextType = {
  initialValues: Record<VmSettingsField, number>;
  setEdited: React.Dispatch<React.SetStateAction<Record<VmSettingsField, boolean>>>;
  edited: Record<VmSettingsField, boolean>;
};

const InputContext = React.createContext<InputContextType>({} as any);

function InputFieldComponent(props: {
  title: React.ReactNode;
  unit: string;
  inputName: VmSettingsField;
  inputExtraClassName?: string;
  inputProps?: React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >;
}): JSX.Element {
  const context = React.useContext(InputContext);
  const initialValue = context.initialValues[props.inputName];
  const [value, setValue] = React.useState(initialValue);
  const edited = value !== initialValue;
  const onChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.currentTarget.validity.valid) {
        return;
      }
      const value = Number(e.currentTarget.value);
      setValue(value);
      if (edited !== context.edited[props.inputName]) {
        context.setEdited((prev) => ({ ...prev, [props.inputName]: edited }));
      }
    },
    [context, props.inputName, edited],
  );
  return (
    <div className="flex flex-col justify-end">
      <h3 className="text-sm text-gray-400 mb-2">{props.title}</h3>
      <TextInputAddonRight
        inputExtraClassName={props.inputExtraClassName ?? "max-w-[6rem]"}
        inputProps={{
          ...props.inputProps,
          value,
          name: edited ? props.inputName : void 0,
          type: "number",
          onChange,
        }}
        addon={<span>{props.unit}</span>}
      />
    </div>
  );
}

const InputField = React.memo(InputFieldComponent);

function SettingsTabComponent(props: {
  [key in VmSettingsField]: number;
}): JSX.Element {
  const vmSettings = props;
  const [edited, setEdited] = React.useState(
    Object.fromEntries(VmSettingsFields.map((field) => [field, false])) as Record<
      VmSettingsField,
      boolean
    >,
  );

  return (
    <InputContext.Provider value={{ initialValues: vmSettings, setEdited, edited }}>
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
              />
              <InputField
                title="RAM"
                inputProps={{
                  min: 1,
                }}
                unit="MiB"
                inputName={VmSettingsField.maxPrebuildRamMib}
              />
              <InputField
                title="Max Root Filesystem Size"
                inputProps={{
                  min: 1,
                }}
                unit="MiB"
                inputExtraClassName="max-w-[10rem]"
                inputName={VmSettingsField.maxPrebuildRootDriveSizeMib}
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
              Resources available to a virtual machine running a prebuild. Increasing filesystem
              size will lengthen prebuild times. You should change it if your workspace image is too
              large.
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
              />
              <InputField
                title="RAM"
                inputProps={{
                  min: 1,
                }}
                unit="MiB"
                inputName={VmSettingsField.maxWorkspaceRamMib}
              />
              <InputField
                title="Max Root Filesystem Size"
                inputProps={{
                  min: 1,
                }}
                unit="MiB"
                inputExtraClassName="max-w-[10rem]"
                inputName={VmSettingsField.maxWorkspaceRootDriveSizeMib}
              />
              <InputField
                title="Max Root Project Size"
                inputProps={{
                  min: 1,
                }}
                unit="MiB"
                inputExtraClassName="max-w-[10rem]"
                inputName={VmSettingsField.maxWorkspaceProjectDriveSizeMib}
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
    </InputContext.Provider>
  );
}

export const SettingsTab = React.memo(SettingsTabComponent);
