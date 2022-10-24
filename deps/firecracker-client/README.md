### Source

openapi-schema.yaml taken from https://github.com/firecracker-microvm/firecracker/blob/v1.1.2/src/api_server/swagger/firecracker.yaml

### Generation Instructions

```bash
npx openapi-generator-cli generate \
  -i ./openapi-schema.yaml \
  -o . \
  -g typescript-axios \
  --additional-properties=supportsES6=true,npmVersion=6.9.0,typescriptThreePlus=true
```
