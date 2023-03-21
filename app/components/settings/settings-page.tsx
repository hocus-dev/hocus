import { Flowbite, Sidebar } from "flowbite-react";
import React from "react";
import { getUserSettingsPath, SettingsPageTab } from "~/page-paths.shared";
import { numericSort } from "~/utils.shared";

import { AppPage } from "../app-page";

const SettingsPageTabNameIconOrder: Record<SettingsPageTab, [string, string, number]> = {
  [SettingsPageTab.SshKeys]: ["SSH Keys", "fa-solid fa-key", 0],
  [SettingsPageTab.Git]: ["Git", "fa-solid fa-code-merge", 1],
};

export const SettingsPage = (props: {
  tab: SettingsPageTab;
  children: React.ReactNode;
}): JSX.Element => {
  const tabsInOrder = Object.entries(SettingsPageTabNameIconOrder).sort((a, b) =>
    numericSort(a[1][2], b[1][2]),
  );
  return (
    <AppPage>
      <h1 className="mt-8 mb-4 font-bold text-4xl">Settings</h1>
      <div className="grow grid grid-cols-[12rem_minmax(0,_1fr)] border border-gray-700 rounded-lg">
        <Flowbite
          theme={{
            theme: {
              sidebar: {
                base: "!w-full",
                inner: "overflow-x-hidden overflow-y-auto bg-white my-4 m-3 dark:bg-gray-800",
              },
            },
          }}
        >
          <Sidebar>
            <Sidebar.Items>
              <Sidebar.ItemGroup>
                {tabsInOrder.map(([tabId, [tabName, tabIcon]]) => (
                  <Sidebar.Item
                    key={tabId}
                    href={getUserSettingsPath(tabId as any)}
                    active={props.tab === tabId}
                  >
                    <div>
                      <i className={`${tabIcon} mr-2`}></i>
                      <span>{tabName}</span>
                    </div>
                  </Sidebar.Item>
                ))}
              </Sidebar.ItemGroup>
            </Sidebar.Items>
          </Sidebar>
        </Flowbite>
        <div className="border-l border-gray-700 p-8">{props.children}</div>
      </div>
    </AppPage>
  );
};
