import { METADATA_ENCODING_KEY, encodingKeys, encodingTypes } from "@temporalio/common";
import type * as proto from "@temporalio/proto";
import cors from "cors";
import express from "express";
import { EJSON } from "bson";
import { CborXDataConverter } from "~/temporal/data-converter";

type ProtoPayload = proto.temporal.api.common.v1.IPayload;

interface ProtoJSONPayload {
  metadata?: Record<string, string> | null;
  data?: string | null;
}

interface Body {
  payloads: ProtoJSONPayload[];
}

/**
 * Helper function to convert a valid proto JSON to a payload object.
 *
 * This method will be part of the SDK when it supports proto JSON serialization.
 */
function fromProtoJSON({ metadata, data }: ProtoJSONPayload): ProtoPayload {
  return {
    metadata:
      metadata &&
      Object.fromEntries(
        Object.entries(metadata).map(([k, v]): [string, Uint8Array] => [
          k,
          Buffer.from(v, "base64"),
        ]),
      ),
    data: data ? Buffer.from(data, "base64") : undefined,
  };
}

/**
 * Helper function to convert a payload object to a valid proto JSON.
 *
 * This method will be part of the SDK when it supports proto JSON serialization.
 */
function toProtoJSON({ metadata, data }: ProtoPayload): ProtoJSONPayload {
  return {
    metadata:
      metadata &&
      Object.fromEntries(
        Object.entries(metadata).map(([k, v]): [string, string] => [
          k,
          Buffer.from(v).toString("base64"),
        ]),
      ),
    data: data ? Buffer.from(data).toString("base64") : undefined,
  };
}

async function run() {
  const port = process.env.PORT || 3000;
  const app = express();
  app.use(cors({ allowedHeaders: ["x-namespace", "content-type"] }));
  app.use(express.json());
  app.options("*", cors());

  const codec = new CborXDataConverter();

  app.post("/decode", async (req, res) => {
    try {
      const { payloads: raw } = req.body as Body;
      const encoded = raw.map(fromProtoJSON);
      const decoded = encoded.map((x) => {
        return {
          metadata: { [METADATA_ENCODING_KEY]: encodingKeys.METADATA_ENCODING_JSON },
          data: new TextEncoder().encode(EJSON.stringify(codec.fromPayload(x))),
        };
      });
      const payloads = decoded.map(toProtoJSON);
      res.json({ payloads }).end();
    } catch (err) {
      console.error("Error in /decode", err);
      res.status(500).end("Internal server error");
    }
  });

  app.post("/encode", async (req, res) => {
    try {
      const { payloads: raw } = req.body as Body;
      const decoded = raw.map(fromProtoJSON);
      const encoded = decoded.map((x) => {
        return codec.toPayload(
          EJSON.parse(new TextDecoder().decode(x.data as any)),
        ) as ProtoPayload;
      });
      const payloads = encoded.map(toProtoJSON);
      res.json({ payloads }).end();
    } catch (err) {
      console.error("Error in /encode", err);
      res.status(500).end("Internal server error");
    }
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, resolve);
    app.on("error", reject);
  });

  console.log(`Codec server listening on port ${port}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
