<#import "template.ftl" as layout>
<@layout.registrationLayout displayInfo=social.displayInfo; section>


<div class="flex flex-col justify-center w-full h-full">
  <div class="h-32 w-full flex flex-col justify-center">
    <div class="w-full flex justify-center mb-2">
      <img src="${url.resourcesPath}/img/logo-leaf.png" class="h-6" alt="Hocus Logo" />
    </div>
    <h1 class="text-3xl font-bold text-center">Hocus</h1>
  </div>
  <div class="grow"></div>
  <div>
    <h2 class="text-xl font-bold text-center mb-2">Continue with your identity provider</h2>
    <h2 class="text-md text-center mb-12">You’ll use this provider to log in to Hocus</h2>
    <div class="flex w-full justify-center">
      <#list social.providers as p>
        <#if p.providerId == "github">
          <a href="${p.loginUrl}" class="${p.providerId}">
            <button type="submit" class="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 dark:bg-gray-800 dark:text-white dark:border-gray-300 dark:hover:bg-gray-700 dark:hover:border-gray-400 dark:focus:ring-gray-700">
              <div class="flex gap-2 align-center">
                <img width="24px" src="${url.resourcesPath}/img/${p.providerId}.svg" alt="${p.displayName} Logo">
                <p class="text-md leading-6">Continue with ${p.displayName}</p>
              <div>
            </button>
          </a>
        </#if>
      </#list>
    </div>
  </div>
  <div class="grow"></div>
  <div class=h-32></div>
</div>
</@layout.registrationLayout>