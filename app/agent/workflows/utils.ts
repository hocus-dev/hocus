export const getArchivePrebuildLockId = (gitRepositoryId: bigint) =>
  `archive-prebuild-${gitRepositoryId}`;
