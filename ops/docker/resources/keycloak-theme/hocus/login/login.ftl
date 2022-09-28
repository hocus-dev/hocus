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
            <button type="submit" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mb-2 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800">
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