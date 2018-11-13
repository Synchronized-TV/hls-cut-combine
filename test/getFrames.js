const ffprobe = require('ffprobe-static').path;
const proc = require('child_process');

function execute(cmd) {
  return new Promise((resolve, reject) => {
    proc.exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr);
      }

      resolve(stdout);
    });
  });
}

module.exports = async function getFrames(input) {
  const out = await execute(
    `${ffprobe} -print_format json -select_streams v -show_frames -show_entries stream=duration ${input}`
  );
  return JSON.parse(out);
};
