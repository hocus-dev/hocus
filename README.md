# Auth

If gotrue is deployed on a different domain than the main app, its cookie domain must be configured.
https://github.com/supabase/gotrue/blob/1c9a4dca45298eb534b03a2c2521603b6ee45728/conf/configuration.go#L205

# Welcome to Remix!

- [Remix Docs](https://remix.run/docs)

## Development

Start the Remix development asset server and the Express server by running:

```sh
npm run dev
```

This starts your app in development mode, which will purge the server require cache when Remix rebuilds assets so you don't need a process manager restarting the express server.

## How to pg_dump the keycloak database

```bash
docker run --network=host -it -e PGPASSWORD=pass postgres:alpine pg_dump -h localhost -U postgres keycloak > ops/docker/resources/keycloak-db-dump.sql
sed -i "s/$GITHUB_APP_HOCUS_DEV_CLIENT_SECRET/github_client_secret_goes_here/g" ops/docker/resources/keycloak-db-dump.sql
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying express applications you should be right at home just make sure to deploy the output of `remix build`

- `build/`
- `public/build/`

### Using a Template

When you ran `npx create-remix@latest` there were a few choices for hosting. You can run that again to create a new project, then copy over your `app/` folder to the new project that's pre-configured for your target server.

```sh
cd ..
# create a new project, and pick a pre-configured host
npx create-remix@latest
cd my-new-remix-app
# remove the new project's app (not the old one!)
rm -rf app
# copy your app over
cp -R ../my-old-remix-app/app app
```
