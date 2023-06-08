/* eslint-disable */
const repo = process.env.OCI_PROXY ?? "quay.io";
export const testImages = {
  test1: `${repo}/hocus/hocus-block-registry-tests@sha256:cd03e262d2462f12649eb4ad7c8e037edccfd3fa1b49fa116635a5658687c514`,
  test2: `${repo}/hocus/hocus-block-registry-tests@sha256:993a42be154398b3b39bdc4189127fc8a3c931f4ef3bc4da010660ff00353b07`,
  testAlpine3_14: `${repo}/hocus/hocus-block-registry-tests@sha256:167b049c913e5db9ec7c61423ee3ea070af7f738712a2a2bd229660c183a92bc`,
  testAlpine3_14NoSSH: `${repo}/hocus/hocus-block-registry-tests@sha256:136de693f53f522ca37dc728752ddc67db336d54fb512bd44d21c7fde05f133c`,
  testDebianBookworm: `${repo}/hocus/hocus-block-registry-tests@sha256:efec44220708e4c5da397739f3923087df149ba9c022d3fca2d128f73152d61a`,
  testDebianBuster: `${repo}/hocus/hocus-block-registry-tests@sha256:e63e5e0f1ac876d076bff30c9079a905ef3c5d15db0f218f4ace2a4839870e09`,
  testUbuntuFocal: `${repo}/hocus/hocus-block-registry-tests@sha256:4899580fc4ad940a6f2edf851edb98f69f91aef315fac57d8d48503eea76fbbc`,
  testUbuntuJammy: `${repo}/hocus/hocus-block-registry-tests@sha256:901dfad3fa8e476eaca4901e382e35a8acf9994685dc638abf84e9d76ff4ac85`,
  testArchlinux: `${repo}/hocus/hocus-block-registry-tests@sha256:08fe147c6c2ff8136d8329f862a09b6aeb7121f5a464d72dc1977014b24771e7`,
  testNixos: `${repo}/hocus/hocus-block-registry-tests@sha256:867357660d74c9d6702f7a9808ce2f1388bef2c11f757f5f7587713ffa05c65e`,
} as const;
