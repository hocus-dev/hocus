
import * as fs from "fs"
import * as child_process from "child_process"

const cwd = process.cwd();
const conf = {
  resultFile: "/tmp/poc-result",
  upper: {
    index: `${cwd}/buildkite-obd-write-layer/index`,
    data: `${cwd}/buildkite-obd-write-layer/data`
  },
  lowers: []
};
const manifest = JSON.parse(fs.readFileSync("poc-dir-export-meta/manifest.json"))
for(let layer of manifest.layers) {
	let layer_digest = layer.annotations["containerd.io/snapshot/overlaybd/blob-digest"];
	let target_digest = layer.annotations["containerd.io/snapshot/overlaybd/fastoci/target-digest"]
	if (target_digest === void 0) {
		// Ok a normal overlaybd layer
		conf.lowers.push({file: `${cwd}/poc-dir-export-meta/${layer_digest.replace("sha256:", "")}`})
	} else {
		// Fastoci is somewhat more complex
		layer_digest = layer_digest.replace("sha256:", "");
		target_digest = target_digest.replace("sha256:", "");
		child_process.spawnSync("mkdir", [`${cwd}/poc-dir-export-meta/${layer_digest}-unpack`])
		child_process.spawnSync("tar", ["-zxvf", `${cwd}/poc-dir-export-meta/${layer_digest}`, "-C", `${cwd}/poc-dir-export-meta/${layer_digest}-unpack`])
		conf.lowers.push({
		// This is the meta image
		file: `${cwd}/poc-dir-export-meta/${layer_digest}-unpack/ext4.fs.meta`,
		gzipIndex: `${cwd}/poc-dir-export-meta/${layer_digest}-unpack/gzip.meta`,
		// And this is the target OCI image
		targetFile: `${cwd}/poc-dir-export-main/${target_digest}`
		})
	}
}
console.log(JSON.stringify(conf))

