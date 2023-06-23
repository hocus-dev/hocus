import { BlockRegistryService } from "./registry.service";

export const expectContent = async (
  brService: BlockRegistryService,
  args: {
    numTotalContent: number;
    prefix?: {
      value: string;
      numPrefixedContent: number;
    };
  },
): Promise<void> => {
  const contentList = await brService.listContent();
  expect(contentList.length).toEqual(args.numTotalContent);
  const prefix = args.prefix;
  if (prefix !== void 0) {
    expect(
      contentList.filter((c) => BlockRegistryService.extractOutputId(c).startsWith(prefix.value))
        .length,
    ).toEqual(prefix.numPrefixedContent);
  }
};
