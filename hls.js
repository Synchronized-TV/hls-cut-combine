const m3u8 = require('m3u8');
const { createReadStream: CreateReadStream } = require('streamifier');
const url = require('url');
const requestPromise = require('request-promise-native');
const memoize = require('nano-memoize');
const traverse = require('traverse');
const qs = require('qs');
const path = require('path');
const { round, getFileNameAtIndex } = require('./utils');

const { unserialize } = m3u8.M3U;

function getResolvedParams(params, mediaPlaylistUri) {
  return params.map(({ key, start, end }) => ({
    start,
    end,
    uri: `${process.env.URI_PREFIX}${url.resolve(key, mediaPlaylistUri)}`
  }));
}

function parseM3u8FromString(buffer) {
  const parser = m3u8.createStream();
  const promise = new Promise(resolve => parser.on('m3u', resolve));
  const stream = new CreateReadStream(buffer);

  stream.pipe(parser);

  return promise;
}

const getPlaylist = memoize(async uri => (await parseM3u8FromString(await requestPromise(uri))).serialize());

async function getClippedMediaPlaylist({ key, start, end }) {
  const mediaPlaylist = unserialize(await parseM3u8FromString(process.env.MEDIA_TEMPLATE));
  const item = mediaPlaylist.items.PlaylistItem[0];
  const { uri: template, duration } = item.properties;
  const firstIndex = Math.floor(start / duration);
  const lastIndex = Math.ceil(end / duration);
  const length = lastIndex - firstIndex;
  const segments = Array.from({ length }).map((_, i) => {
    const index = firstIndex + i;
    const clipStart = index * duration;
    const fileName = getFileNameAtIndex({ template, index });
    let needsClip = false;
    let relativeStart = 0;
    let relativeEnd = duration;

    if (length === 1) {
      needsClip = true;
      relativeStart = start - clipStart;
      relativeEnd = end - clipStart;
    }
    else if (i === 0) {
      needsClip = true;
      relativeStart = start - clipStart;
    }
    else if (i === length - 1) {
      needsClip = true;
      relativeEnd = end - clipStart;
    }

    if (relativeStart === 0 && relativeEnd === duration) {
      needsClip = false;
    }

    const outputKey = `${fileName.replace(/.ts$/, '')}--clip--${relativeStart}--${relativeEnd}.ts`;
    const newDuration = round(relativeEnd - relativeStart);
    const inputKey = getFileNameAtIndex({ template, index });
    const newKey = needsClip ? outputKey : inputKey;

    return {
      ...item,
      clip: needsClip && {
        input: `${process.env.S3_PREFIX}${url.resolve(key, inputKey)}`,
        output: `${process.env.S3_PREFIX}${url.resolve(key, outputKey)}`,
        relativeStart,
        relativeEnd
      },
      properties: {
        ...item.properties,
        duration: newDuration,
        uri: `${process.env.URI_PREFIX}${url.resolve(key, newKey)}`
      }
    };
  });

  return {
    ...mediaPlaylist,
    items: {
      ...mediaPlaylist.items,
      PlaylistItem: segments
    }
  };
}

async function getCombinedMediaPlaylist(params) {
  const clippedMediaPlaylists = await Promise.all(
    params.map(it => unserialize(getClippedMediaPlaylist(it)))
  );

  const [combinedMediaPlaylist, ...otherMediaPlaylists] = clippedMediaPlaylists;
  otherMediaPlaylists.forEach(mediaPlaylist => combinedMediaPlaylist.merge(unserialize(mediaPlaylist)));

  return combinedMediaPlaylist;
}

async function getCombinedMasterPlaylist(params) {
  const masterPlaylist = (await parseM3u8FromString(process.env.MASTER_TEMPLATE)).serialize();

  return {
    ...masterPlaylist,
    items: {
      StreamItem: masterPlaylist.items.StreamItem.map(item => ({
        ...item,
        properties: {
          ...item.properties,
          uri: `?${qs.stringify({
            type: 'media',
            params: getResolvedParams(params, item.properties.uri)
          })}`
        }
      }))
    }
  };
}

function getJob({ clip }) {
  const folder = path.basename(path.dirname(clip.input));
  const input = `${url.resolve(clip.input, process.env.RESOLVE_BEST_QUALITY)}/${path.basename(
    clip.input
  )}`;

  return {
    ...clip,
    outputOptions: process.env[`FFMPEG_OPTIONS_${folder}`]
      .split(' -')
      .map((it, i) => (i ? `-${it}` : it)),
    input
  };
}

async function getHlsJobs(params) {
  const masterPlaylist = (await parseM3u8FromString(process.env.MASTER_TEMPLATE)).serialize();
  const mediaUris = masterPlaylist.items.StreamItem.map(item => item.properties.uri);
  const paramsForEachMedia = params.reduce((acc, it) => {
    return acc.concat(
      mediaUris.map(mediaUri => ({
        ...it,
        key: url.resolve(it.key, mediaUri)
      }))
    );
  }, []);

  const clippedMediaPlaylists = await Promise.all(
    paramsForEachMedia.map(it => getClippedMediaPlaylist(it))
  );

  return traverse(clippedMediaPlaylists).reduce((acc, it) => {
    return it && typeof it === 'object' && it.clip ? acc.concat(getJob(it)) : acc;
  }, []);
}

function returnPlaylist(playlist) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/x-mpegurl',
      'Access-Control-Allow-Origin': '*'
    },
    body: playlist.toString().replace(':undefined', '')
  };
}

module.exports = {
  parseM3u8FromString,
  getPlaylist,
  getCombinedMasterPlaylist,
  getCombinedMediaPlaylist,
  getClippedMediaPlaylist,
  getHlsJobs,
  returnPlaylist
};
