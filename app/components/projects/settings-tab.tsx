import type { Project } from "@prisma/client";
import { Alert, Badge, Button } from "flowbite-react";
import React from "react";
import type { Any } from "ts-toolbelt";

import { CsrfInput } from "../csrf-input";
import { TextInputAddonRight } from "../text-input-addon-right";

import type { EditProjectVmSettings } from "~/schema/edit-project-vm-settings.validator.server";

export const VmSettingsFields = [
  "maxPrebuildRamMib",
  "maxPrebuildVCPUCount",
  "maxWorkspaceRamMib",
  "maxWorkspaceVCPUCount",
] as const;

export type VmSettingsField = (typeof VmSettingsFields)[number];
// enforce that VmSettingsField is a subset of Project fields
const _typecheck1: Any.Contains<VmSettingsField, keyof Project> = 1;
// enforce that VmSettingsField is a subset of EditProjectVmSettings fields
const _typecheck2: Any.Contains<VmSettingsField, keyof EditProjectVmSettings> = 1;

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
      const newValue = Number(e.currentTarget.value);
      const nowEdited = newValue !== initialValue;
      setValue(newValue);
      if (nowEdited !== context.edited[props.inputName]) {
        context.setEdited((prev) => ({ ...prev, [props.inputName]: nowEdited }));
      }
    },
    [context, props.inputName, initialValue],
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
  projectExternalId: string;
  vmSettings: Record<VmSettingsField, number>;
  showSuccess: boolean;
}): JSX.Element {
  const vmSettings = props.vmSettings;
  const [edited, setEdited] = React.useState(
    Object.fromEntries(VmSettingsFields.map((field) => [field, false])) as Record<
      VmSettingsField,
      boolean
    >,
  );
  const formEdited = Object.values(edited).some((v) => v);

  return (
    <InputContext.Provider value={{ initialValues: vmSettings, setEdited, edited }}>
      <form method="POST">
        <input type="hidden" name="projectExternalId" value={props.projectExternalId} />
        <CsrfInput />
        <div className="flex flex-col gap-4">
          {props.showSuccess && (
            <Alert color="success">
              <span>Changes saved successfully.</span>
            </Alert>
          )}
          <div className="flex gap-4 justify-between">
            <h1 className="font-bold text-xl mb-4">Project Settings</h1>
            {formEdited && <Badge color="gray">Unsaved changes</Badge>}
          </div>
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
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Resources available to a virtual machine running a prebuild.
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
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Resources available inside a workspace.
            </p>
          </div>
          <div className="border-t border-gray-700"></div>

          <div className="flex justify-end">
            <Button className="w-fit" type="submit" color="success" disabled={!formEdited}>
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
