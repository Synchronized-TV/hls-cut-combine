const url = require('url');

function getCombinedThumbs({ key, start, end }) {
  const duration = parseFloat(process.env.THUMB_DURATION);
  const template = process.env.THUMB_TEMPLATE;
  const outputKey = `${process.env.THUMB_COMBINED_PREFIX}--combine--${start}--${end}.jpg`;
  const fromIndex = Math.ceil(start / duration);
  const toIndex = Math.ceil(end / duration);

  return {
    input: `${process.env.S3_PREFIX}${url.resolve(key, template)}`,
    output: `${process.env.S3_PREFIX}${url.resolve(key, outputKey)}`,
    fromIndex,
    toIndex
  };
}

function getCombinedThumbsUris(params) {
  return params.map(
    ({ key, start, end }) => `${process.env.URI_PREFIX}${url.resolve(
      key,
      `${process.env.THUMB_COMBINED_PREFIX}--combine--${start}--${end}.jpg`
    )}`
  );
}

function getThumbsJobs(params) {
  return params.map(getCombinedThumbs);
}

function returnThumbs(combinedThumbsUris) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(combinedThumbsUris)
  };
}

module.exports = {
  getCombinedThumbsUris,
  getThumbsJobs,
  returnThumbs
};
