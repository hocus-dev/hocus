# GPT-4 Makefile to compile all .json files to TypeScript files using json2ts

# Find all .json files in the current directory
JSON_FILES := $(wildcard vendor/*.json)
# Replace .json extension with .ts for target TypeScript files
TS_FILES := $(notdir $(JSON_FILES:.json=.ts))

# Default target to compile all .json files to .ts
all: $(TS_FILES)

# Rule to compile a single .json file to .ts
%.ts: vendor/%.json
	npx json2ts --cwd vendor/ -i $< -o /tmp/$@
	npx ts-node -r tsconfig-paths/register typebox/typescript-to-typebox.ts /tmp/$@ > ./$@
	rm /tmp/$@

# Clean target to remove all generated .ts files
clean:
	rm -f $(TS_FILES)

.PHONY: all clean