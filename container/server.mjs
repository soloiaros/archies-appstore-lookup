import { createServer } from "node:http";

import {
  AutoTokenizer,
  SiglipTextModel,
} from "@huggingface/transformers";

const MODEL = "onnx-community/siglip2-base-patch16-224-ONNX";

const PORT = 8788;

let loading;

function session() {
  loading ??= (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL);

    const text = await SiglipTextModel.from_pretrained(MODEL, {
      dtype: "fp16",
    });

    return { tokenizer, text };
  })();

  return loading;
}

function flatten(data) {
  const vector = [];

  for (let index = 0; index < data.length; index += 1) {
    vector.push(Number(data[index]));
  }

  return vector;
}

function l2Normalize(values) {
  let sum = 0;

  for (const value of values) {
    sum += value * value;
  }

  const norm = Math.sqrt(sum);

  if (norm === 0) {
    return values;
  }

  return values.map((value) => value / norm);
}

export async function embedIconQuery(query) {
  const { tokenizer, text } = await session();

  const inputs = tokenizer(query, {
    padding: "max_length",
    truncation: true,
    max_length: 64,
  });

  const outputs = await text(inputs);

  return l2Normalize(flatten(outputs.pooler_output.data));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

if (process.argv.includes("--warmup")) {
  const vector = await embedIconQuery("warmup");

  if (vector.length !== 768) {
    console.error("dims", vector.length);
    process.exit(1);
  }

  console.log("warm", vector.length);
  process.exit(0);
}

createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end();
    return;
  }

  try {
    const body = JSON.parse(await readBody(request));

    const vector = await embedIconQuery(String(body.query ?? ""));

    response.writeHead(200, {
      "content-type": "application/json",
    });

    response.end(JSON.stringify({ vector }));
  } catch {
    response.writeHead(500, {
      "content-type": "application/json",
    });

    response.end(JSON.stringify({ error: "embed failed" }));
  }
}).listen(PORT, "0.0.0.0");
