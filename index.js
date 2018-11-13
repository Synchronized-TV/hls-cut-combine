const m3u8 = require("m3u8");
const { createReadStream: CreateReadStream } = require("streamifier");
const url = require("url");
const aws = require("aws-sdk"); // eslint-disable-line
const requestPromise = require("request-promise-native");
const memoize = require("nano-memoize");
const traverse = require("traverse");
const qs = require("qs");
const path = require("path");

const lambda = new aws.Lambda({ region: "eu-west-1" });

const { unserialize } = m3u8.M3U;

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

function getResolvedUris(uris, mediaPlaylistUri) {
  return uris
    .map(uri => uri.split("#"))
    .map(([uri, t]) => `${url.resolve(uri, mediaPlaylistUri)}#${t}`);
}

function getParamsFromUris(uris) {
  return uris.map(uriWithTimeFragment => {
    const [uri, timeFragment = ""] = uriWithTimeFragment.split("#t=");
    const [start, end] = timeFragment.split(",").map(it => parseFloat(it));

    return { uri, start, end };
  });
}

function parseM3u8FromString(buffer) {
  const parser = m3u8.createStream();
  const promise = new Promise(resolve => parser.on("m3u", resolve));
  const stream = new CreateReadStream(buffer);

  stream.pipe(parser);

  return promise;
}

const getPlaylist = memoize(async uri =>
  (await parseM3u8FromString(await requestPromise(uri))).serialize()
);

async function getClippedMediaPlaylist(
  { uri, start, end },
  unserialized = true
) {
  const mediaPlaylist = unserialize(
    await parseM3u8FromString(process.env.MEDIA_TEMPLATE)
  );
  const item = mediaPlaylist.items.PlaylistItem[0];
  const { uri: itemUri, duration } = item.properties;
  const suffixPos = itemUri.search(/[0-9]+/);
  const prefix = itemUri.substr(0, suffixPos);
  const suffix = itemUri.substr(suffixPos).split(".ts")[0];
  const { length: padLength } = suffix;
  const baseIndex = parseInt(suffix, 10);
  const firstIndex = baseIndex + Math.floor(start / duration);
  const lastIndex = baseIndex + Math.ceil(end / duration);
  const length = lastIndex - firstIndex;

  const segments = Array.from({ length }).map((_, i) => {
    const index = firstIndex + i;
    const clipStart = (index - baseIndex) * duration;
    const clipEnd = clipStart + duration;
    const originalUri = `${prefix}${pad(index, padLength)}.ts`;
    let needsClip = false;
    let relativeStart = 0;
    let relativeEnd = duration;

    if (length === 1) {
      needsClip = true;
      relativeStart = start - clipStart;
      relativeEnd = end - clipStart;
    } else if (i === 0) {
      needsClip = true;
      relativeStart = start - clipStart;
    } else if (i === length - 1) {
      needsClip = true;
      relativeEnd = end - clipStart;
    }

    if (relativeStart === 0 && relativeEnd === duration) {
      needsClip = false;
    }

    const newUri = needsClip
      ? `${prefix}${pad(
          index,
          padLength
        )}--clip--${relativeStart}--${relativeEnd}.ts`
      : originalUri;

    return {
      ...item,
      clip: needsClip && {
        start,
        end,
        cutStart: clipStart + relativeStart,
        cutEnd: clipStart + relativeEnd,
        clipStart,
        clipEnd,
        relativeStart,
        relativeEnd
      },
      properties: {
        ...item.properties,
        duration: round(relativeEnd - relativeStart),
        uri: url.resolve(uri, newUri)
      }
    };
  });

  const result = {
    ...mediaPlaylist,
    items: {
      ...mediaPlaylist.items,
      PlaylistItem: segments
    }
  };

  return unserialized ? unserialize(result) : result;
}

async function getCombinedMediaPlaylist(uris) {
  const params = getParamsFromUris(uris);
  const clippedMediaPlaylists = await Promise.all(
    params.map(it => getClippedMediaPlaylist(it, true))
  );

  const [combinedMediaPlaylist, ...otherMediaPlaylists] = clippedMediaPlaylists;
  otherMediaPlaylists.forEach(mediaPlaylist =>
    combinedMediaPlaylist.merge(unserialize(mediaPlaylist))
  );

  return combinedMediaPlaylist;
}

async function getCombinedMasterPlaylist(uris) {
  const masterPlaylist = (await parseM3u8FromString(
    process.env.MASTER_TEMPLATE
  )).serialize();

  return unserialize({
    ...masterPlaylist,
    items: {
      StreamItem: masterPlaylist.items.StreamItem.map(item => ({
        ...item,
        properties: {
          ...item.properties,
          uri: `?${qs.stringify({
            type: "media",
            uris: getResolvedUris(uris, item.properties.uri)
          })}`
        }
      }))
    }
  });
}

function getJob({ clip, properties }) {
  const { uri } = properties;
  const split = uri.split("--clip--");
  const originalUri = `${split[0]}.ts`;
  const folderSplit = uri.split("/");
  const folder = folderSplit[folderSplit.length - 2];
  const inputUri = url.resolve(originalUri, process.env.RESOLVE_MASTER);
  const qualityUri = `${url.resolve(
    originalUri,
    process.env.RESOLVE_BEST_QUALITY
  )}/${path.basename(originalUri)}`;

  return {
    ...clip,
    outputOptions: process.env[`FFMPEG_OPTIONS_${folder}`]
      .split(" -")
      .map((it, i) => (i ? `-${it}` : it)),
    qualityUri,
    originalUri,
    inputUri,
    outputUri: uri
  };
}

async function getJobs(uris) {
  const params = getParamsFromUris(uris);
  const masterPlaylist = (await parseM3u8FromString(
    process.env.MASTER_TEMPLATE
  )).serialize();
  const mediaUris = masterPlaylist.items.StreamItem.map(
    item => item.properties.uri
  );
  const paramsForEachMedia = params.reduce((acc, it) => {
    return acc.concat(
      mediaUris.map(mediaUri => ({
        ...it,
        uri: url.resolve(it.uri, mediaUri)
      }))
    );
  }, []);

  const clippedMediaPlaylists = await Promise.all(
    paramsForEachMedia.map(it => getClippedMediaPlaylist(it, false))
  );

  return traverse(clippedMediaPlaylists).reduce((acc, it) => {
    return it && typeof it === "object" && it.clip
      ? acc.concat(getJob(it))
      : acc;
  }, []);
}

async function uriExists(uri) {
  try {
    await requestPromise({ uri, method: "HEAD" });
    return true;
  } catch (e) {
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

async function executeJobs(uris) {
  const jobs = await getJobs(uris);
  return Promise.all(jobs.map(executeJob));
}

function returnPlaylist(playlist) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/x-mpegurl",
      "Access-Control-Allow-Origin": "*"
    },
    body: playlist.toString().replace(":undefined", "")
  };
}

module.exports = {
  parseM3u8FromString,
  getParamsFromUris,
  getPlaylist,
  getCombinedMasterPlaylist,
  getCombinedMediaPlaylist,
  getClippedMediaPlaylist,
  getJobs,
  executeJob,
  executeJobs,
  returnPlaylist
};
