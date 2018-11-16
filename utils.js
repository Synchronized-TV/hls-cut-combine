const aws = require('aws-sdk'); // eslint-disable-line
const requestPromise = require('request-promise-native');
const {
  M3U: { unserialize }
} = require('m3u8');

const lambda = new aws.Lambda({ region: 'eu-west-1' });

function pad(it, length = 2) {
  let nb = it;
  while (`${nb}`.length < length) {
    nb = `0${nb}`;
  }
  return nb;
}

function round(it) {
  return Math.round(it * 10000) / 10000;
}

async function uriExists(uri) {
  try {
    await requestPromise({ uri, method: 'HEAD' });
    return true;
  }
  catch (e) {
    return false;
  }
}

async function executeJob(job) {
  if (!(await uriExists(job.outputUri))) {
    const result = await lambda
      .invoke({
        FunctionName: process.env.JOB_FUNCTION_NAME,
        Payload: JSON.stringify(job)
      })
      .promise();
    if (result.FunctionError) {
      throw new Error(JSON.parse(result.Payload).errorMessage);
    }
  }
}

async function executeJobs(jobs) {
  return Promise.all(jobs.map(executeJob));
}

function getFileNameAtIndex({ template, index }) {
  const prefix = template.split('/');
  const fileName = prefix.pop();
  const number = fileName.match(/\d/g).join('');
  const { length } = number;
  const baseIndex = parseInt(number, 10);
  return prefix.concat(fileName.replace(number, pad(baseIndex + index, length))).join('/');
}

function playlistToString(playlist) {
  return unserialize(playlist).toString();
}

function getBucketAndKey(key) {
  const [Bucket, ...Key] = key.replace('s3://', '').split('/');
  return [Bucket, Key.join('/')];
}

module.exports = {
  pad,
  round,
  getFileNameAtIndex,
  playlistToString,
  getBucketAndKey,
  executeJob,
  executeJobs
};
