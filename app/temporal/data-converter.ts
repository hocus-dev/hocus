import {
  CompositePayloadConverter,
  METADATA_ENCODING_KEY,
  encodingKeys,
  encodingTypes,
} from "@temporalio/common";
import type { Payload, PayloadConverterWithEncoding, PayloadConverter } from "@temporalio/common";
import { encode, decode } from "cbor-x";

export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

/**
 * Exists because the default converter doesn't support BigInts, Dates, and others.
 *
 * Based on https://github.com/temporalio/sdk-typescript/blob/bf4ccdf3c7baae544297d19d66cf047957eedbdb/packages/common/src/converter/payload-converter.ts#L219-L248
 */
export class CborXDataConverter implements PayloadConverterWithEncoding {
  encodingType = encodingTypes.METADATA_ENCODING_RAW;

  toPayload(data: unknown): Payload | undefined {
    if (data === void 0) {
      return void 0;
    }

    return {
      metadata: { [METADATA_ENCODING_KEY]: encodingKeys.METADATA_ENCODING_RAW },
      data: encode(data),
    };
  }

  fromPayload<T>(payload: Payload): T {
    if (payload.data === undefined || payload.data === null) {
      throw new ValueError("Got payload with no data");
    }
    return decode(payload.data) as any;
  }
}

export const payloadConverter: PayloadConverter = new CompositePayloadConverter(
  new CborXDataConverter(),
);
