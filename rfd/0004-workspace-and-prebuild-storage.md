---
authors: Hugo Dutka (contact@hugodutka.com)
state: draft
---

# RFD 4 - Workspace and prebuild storage management

## What

Specify high-level workspace and prebuild storage management in Hocus using [the local block registry](./0001-block-registry.md) and a remote OCI registry.

## Why

Goals:

1. Store data without duplication between workspaces that use the same prebuilds.
2. Allow sharing prebuilds between users on different machines to avoid redundant builds.
3. Enable fast workspace start-up, even without local caching.

Storage backed by OCI images and powered by [overlaybd](https://github.com/containerd/overlaybd) with lazy pulling fits these requirements.

## Details

### Why OCI images?

Using OCI images lets us benefit from the OCI ecosystem. In particular, we make heavy use of overlaybd, which underpins our local block registry. Overlaybd supports lazy pulling, which allows us to run a workspace without fully downloading its backing files, and then download the rest in the background. We can also use standardized OCI registries for long-term storage and transferring images between machines, eliminating the need for a custom solution.

### Types of images Hocus needs

Hocus needs to keep track of the following types of images:

- git repository images
- prebuild images, two types:
  - code images (based on git repository images)
  - os images
- workspace images, two types:
  - code images (based on prebuild code images)
  - os images (based on prebuild os images)

In total, there are 5 types of images Hocus manages.

### Local and remote storage of images

Prebuild images are pushed to a user-configurable OCI registry after they are built. Every prebuild has a tag that is partly deterministic, which allows us to check if it's been built before and if the agent can download it instead of building. After they are downloaded or built, prebuild images are stored on disk until the associated prebuild is archived. Workspace images are based on prebuild images, but for now they are only stored locally and never pushed to a remote location. They are deleted once a workspace is deleted. Git repository images are not pushed to a remote registry for now.

Hocus does not remove tags from the remote registry. It's up to the user to configure a retention period in the registry themselves.

### Prebuild image tags

Prebuilds consist of two images: one that contains the git repository, and one that contains all the other OS files. Prebuild image tags have the following format:

```js
`${deterministicPart}-prebuild-${"repo" | "os"}-${randomId}`;
```

The deterministic part is the result of:

```js
sha256(`${gitRepositoryUrl}-${gitObjectHash}-${projectRootDir}`);
```

The deterministic part lets us check if a prebuild was completed before and if the agent can download it instead of building. The agent does it by computing the deterministic part and then querying the [`/v2/<name>/tags/list?n=<int>&last=<deterministicPart>-` registry endpoint](https://github.com/opencontainers/distribution-spec/blob/8e2a64e837af0392c0eabe7f36f79ff621159fe7/spec.md#listing-tags). For example, here's how to do it with curl:

```bash
response=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:hocusdev/workspace:pull")
token=$(echo "$response" | jq -r '.token')
export DOCKER_REGISTRY_TOKEN="$token"
curl -H "Authorization: Bearer $DOCKER_REGISTRY_TOKEN" "https://registry-1.docker.io/v2/hocusdev/workspace/tags/list?n=5&last=02-06-2023"
```

The endpoint returns a list of `n` tags in lexicographical after the `last` tag, but not including it. If any tags with the deterministic part prefix are returned, the agent can download one of them instead of building.

### Workspace image tags

Workspaces are created from prebuilds, and they also consist of two images. Workspace image tags have the following format:

```js
`${deterministicPart}-workspace-${"repo" | "os"}-${randomId}`;
```

The deterministic part is the same as the underlying prebuild's.

### Git repository image tags

Their tag format is:

```js
${deterministicPart}-${lastFetchTimestampSeconds}-${randomId}
```

It's likely to change in the future when we start coordinating agents to reuse git repository images more efficiently.

The deterministic part is the result of

```js
sha256(gitRepositoryUrl);
```
