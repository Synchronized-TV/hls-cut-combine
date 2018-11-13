const { expect } = require('chai');
const { createReadStream } = require('fs');
const path = require('path');
const { createStream } = require('m3u8');
const qs = require('qs');
const url = require('url');
const {
  getClippedMediaPlaylist,
  getCombinedMediaPlaylist,
  getJobs,
  executeJobs,
  getCombinedMasterPlaylist
} = require('../utils');
const getFrames = require('./getFrames');

process.env.JOB_FUNCTION_NAME = 'hlsClip';
process.env.RESOLVE_MASTER = '../../master.mp4';
process.env.RESOLVE_BEST_QUALITY = '../540p_3500k';
process.env.MASTER_TEMPLATE = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=590320,AVERAGE-BANDWIDTH=590320,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=480x270,FRAME-RATE=25.000
playlist/270p_400k/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=834719,AVERAGE-BANDWIDTH=834719,CODECS="avc1.4d401f,mp4a.40.5",RESOLUTION=640x360,FRAME-RATE=25.000
playlist/360p_600k/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1509326,AVERAGE-BANDWIDTH=1509326,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=25.000
playlist/360p_1200k/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3800419,AVERAGE-BANDWIDTH=3800419,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=25.000
playlist/540p_3500k/playlist.m3u8`;

process.env.MEDIA_TEMPLATE = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:6.000,
playlist_00001.ts
#EXT-X-ENDLIST`;

process.env.FFMPEG_OPTIONS_270p_400k = '-preset veryfast -filter:v scale=480:-1 -framerate 25 -profile:v main -b:v 400000 -level 3.1 -b:a 64000 -g 75 -bf 3 -muxdelay 0 -muxpreload 0 -streamid 0:481 -streamid 1:482 -movflags +faststart';
process.env.FFMPEG_OPTIONS_360p_600k = '-preset veryfast -filter:v scale=640:-1 -framerate 25 -profile:v main -b:v 600000 -level 3.1 -b:a 64000 -g 75 -bf 3 -muxdelay 0 -muxpreload 0 -streamid 0:481 -streamid 1:482 -movflags +faststart';
process.env.FFMPEG_OPTIONS_360p_1200k = '-preset veryfast -filter:v scale=640:-1 -framerate 25 -profile:v main -b:v 1200000 -level 3.1 -b:a 96000 -g 75 -bf 3 -muxdelay 0 -muxpreload 0 -streamid 0:481 -streamid 1:482 -movflags +faststart';
process.env.FFMPEG_OPTIONS_540p_3500k = '-preset veryfast -filter:v scale=960:-1 -framerate 25 -profile:v main -b:v 3500000 -level 3.1 -b:a 96000 -g 75 -bf 3 -muxdelay 0 -muxpreload 0 -streamid 0:481 -streamid 1:482 -movflags +faststart';

console.error = () => {}; // eslint-disable-line

function getTestPlaylist(filePath) {
  return new Promise((resolve) => {
    const parser = createStream();
    const file = createReadStream(filePath);
    file.pipe(parser);
    parser.on('m3u', resolve);
  });
}

function getMediaPlaylist() {
  return getTestPlaylist(path.resolve(__dirname, './media.m3u8'));
}
/*
describe('clipPlaylist()', () => {
  it('should clip playlist between times', async () => {
    const playlist = await getMediaPlaylist();
    await clipPlaylist(playlist, 'http://test.com/playlist.m3u8', 7, 13);

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:1.0000,
/clip.ts?uri=http%3A%2F%2Ftest.com%2F1080p_001.ts&start=3&duration=1
#EXTINF:4.0000,
http://test.com/1080p_002.ts
#EXTINF:1.0000,
/clip.ts?uri=http%3A%2F%2Ftest.com%2F1080p_003.ts&start=0&duration=1
#EXT-X-ENDLIST
`;

    expect(playlist.toString()).to.be.equal(expected);
  });

  it('should be correct at exact segment time', async () => {
    const playlist = await getMediaPlaylist();
    await clipPlaylist(playlist, 'http://test.com/playlist.m3u8', 0, 4);

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:4.0000,
http://test.com/1080p_000.ts
#EXT-X-ENDLIST
`;

    expect(playlist.toString()).to.be.equal(expected);
  });

  it('should return all segments if over duration', async () => {
    const playlist = await getMediaPlaylist();
    const { length } = playlist.items.PlaylistItem;
    await clipPlaylist(playlist, 'http://test.com/playlist.m3u8', 0, 1000);

    expect(playlist.items.PlaylistItem.length).to.be.equal(length);
  });

  it('should return clipped file url if it exists', async () => {
    const playlist = await getMediaPlaylist();
    await clipPlaylist(playlist, 'http://test.com/playlist.m3u8', 0, 7, () => true);

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:4
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:4.0000,
http://test.com/1080p_000.ts
#EXTINF:3.0000,
http://test.com/1080p_001.ts%3Fstart%3D0%26duration%3D3
#EXT-X-ENDLIST
`;

    expect(playlist.toString()).to.be.equal(expected);
  });
});

describe('getMasterPlaylists()', () => {
  it('should return master playlists from uris', async () => {
    const uris = [
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=10,28',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=12,38'
    ];

    const playlists = await getMasterPlaylists(uris);

    const expected = [
      '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=5915800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs0/manifest.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=3605800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs1/manifest.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=140800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs2/manifest.m3u8\n\n',
      '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=5915800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs0/manifest.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=3605800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs1/manifest.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=140800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"\nvs2/manifest.m3u8\n\n'
    ];

    expect(playlists.map(playlist => playlist.toString())).to.deep.equal(expected);
  });
});

describe('createMasterPlaylistFromUris()', () => {
  it('should create a master playlist from uris', async () => {
    const uris = [
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=10,28',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=12,38'
    ];

    const playlist = await createMasterPlaylistFromUris(uris);

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5915800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"
/media?uris%5B0%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs0%2Fmanifest.m3u8%23t%3D10%2C28&uris%5B1%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs0%2Fmanifest.m3u8%23t%3D12%2C38
#EXT-X-STREAM-INF:BANDWIDTH=3605800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"
/media?uris%5B0%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs1%2Fmanifest.m3u8%23t%3D10%2C28&uris%5B1%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs1%2Fmanifest.m3u8%23t%3D12%2C38
#EXT-X-STREAM-INF:BANDWIDTH=140800,RESOLUTION=640x360,CODECS="avc1.42c029,mp4a.40.2"
/media?uris%5B0%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs2%2Fmanifest.m3u8%23t%3D10%2C28&uris%5B1%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-videos%2Fdest%2Fvs2%2Fmanifest.m3u8%23t%3D12%2C38

`;

    expect(playlist.toString()).to.equal(expected);
  });
});
*/
/*
describe('getSegmentsInRange()', () => {
  it('should get only one segment', async () => {
    const segments = getSegmentsInRange(await getMediaPlaylist(), 10, 12);

    expect(segments.length).to.equal(1);
    expect(segments[0].start).to.equal(8);
    expect(segments[0].end).to.equal(12);
    expect(segments[0].duration).to.equal(4);
  });

  it('should get segments in range', async () => {
    const segments = getSegmentsInRange(await getMediaPlaylist(), 13, 21);

    expect(segments.length).to.equal(3);
    expect(segments[0].start).to.equal(12);
    expect(segments[0].end).to.equal(16);
    expect(segments[0].duration).to.equal(4);
    expect(segments[1].start).to.equal(16);
    expect(segments[1].end).to.equal(20);
    expect(segments[1].duration).to.equal(4);
    expect(segments[2].start).to.equal(20);
    expect(segments[2].end).to.equal(24);
    expect(segments[2].duration).to.equal(4);
  });
});

describe('cutSegments()', () => {
  it('should cut only one segment', async () => {
    const segments = getSegmentsInRange(await getMediaPlaylist(), 10, 12);
    const cutSegments = getCutSegments(segments, 10, 12);

    expect(cutSegments.length).to.equal(1);
    expect(cutSegments[0].start).to.equal(10);
    expect(cutSegments[0].end).to.equal(12);
    expect(cutSegments[0].duration).to.equal(2);
    expect(cutSegments[0].cutStart).to.equal(2);
    expect(cutSegments[0].cutEnd).to.equal(2);
  });

  it('should cut multiple segments', async () => {
    const segments = getSegmentsInRange(await getMediaPlaylist(), 13, 21);
    const cutSegments = getCutSegments(segments, 13, 21);

    expect(cutSegments.length).to.equal(3);
    expect(cutSegments[0].start).to.equal(13);
    expect(cutSegments[0].end).to.equal(16);
    expect(cutSegments[0].duration).to.equal(3);
    expect(cutSegments[0].cutStart).to.equal(1);
    expect(cutSegments[1].start).to.equal(16);
    expect(cutSegments[1].end).to.equal(20);
    expect(cutSegments[1].duration).to.equal(4);
    expect(cutSegments[2].start).to.equal(20);
    expect(cutSegments[2].end).to.equal(21);
    expect(cutSegments[2].duration).to.equal(1);
    expect(cutSegments[2].cutEnd).to.equal(1);
  });
});

describe('combinePlaylists()', () => {
  it('should combine playlists', async () => {
    const playlist = await combinePlaylists([
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=12,26',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/dest/master.m3u8#t=16,36'
    ]);
  });
});
*/

// describe('getClippedMediaPlaylist()', () => {
//   it('should clip playlistmedia', async () => {
//     const playlist = await getClippedMediaPlaylist({
//       start: 2,
//       end: 4,
//       uri:
//         'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8'
//     });

//     console.log(playlist);
//   });
// });

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

describe('getClippedMediaPlaylist()', () => {
  it('should clip playlistmedia', async () => {
    const uris = [
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=38,43',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=2,4',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=44,49'
    ];
    await executeJobs(uris);
    const masterPlaylist = await getCombinedMasterPlaylist(uris);
    const streamItems = masterPlaylist.items.StreamItem;
    const allParams = streamItems.map(it => qs.parse(it.properties.uri, { arrayLimit: 9999 }));

    await asyncForEach(allParams, async (params) => {
      try {
        const mediaPlaylist = await getCombinedMediaPlaylist(params.uris);
        const playlistItems = mediaPlaylist.items.PlaylistItem;
        const videoSegmentUris = playlistItems.map(it => it.properties.uri);

        await asyncForEach(videoSegmentUris, async (videoSegmentUri) => {
          if (videoSegmentUri.includes('--clip--')) {
            console.log(videoSegmentUri);
            const uri = videoSegmentUri;
            const split = uri.split('--clip--');
            const originalUri = `${split[0]}.ts`;
            const [relativeStart, relativeEnd] = split[1]
              .replace('.ts', '')
              .split('--')
              .map(parseFloat);
            const inputUri = url.resolve(originalUri, process.env.RESOLVE_MASTER);
            const qualityUri = `${url.resolve(
              originalUri,
              process.env.RESOLVE_BEST_QUALITY
            )}/${path.basename(originalUri)}`;

            const { frames: originalFrames } = await getFrames(originalUri);
            const { streams: clippedStreams, frames: clippedFrames } = await getFrames(uri);
            const originalInitialPTSTime = parseFloat(originalFrames[0].pkt_pts_time);
            const clippedInitialPTSTime = parseFloat(clippedFrames[0].pkt_pts_time);
            const originalLastPTSTime = parseFloat(
              originalFrames[originalFrames.length - 1].pkt_pts_time
            );
            const clippedLastPTSTime = parseFloat(
              clippedFrames[clippedFrames.length - 1].pkt_pts_time
            );

            if (relativeStart === 0 || relativeEnd === 6) {
              try {
                expect(parseFloat(clippedStreams[0].duration)).to.equal(
                  relativeEnd - relativeStart
                );

                if (relativeStart === 0) {
                  expect(originalInitialPTSTime).to.equal(clippedInitialPTSTime);
                  console.info('OK');
                  // console.log('OK');
                  // console.log('a', originalInitialPTSTime, clippedInitialPTSTime);
                }

                if (relativeEnd === 6) {
                  expect(originalLastPTSTime).to.equal(clippedLastPTSTime);
                  console.info('OK');
                  // console.log('b', originalLastPTSTime, clippedLastPTSTime);
                }

                // console.log('originalInitialPTSTime', originalInitialPTSTime);
                // console.log('clippedInitialPTSTime', clippedInitialPTSTime);
                // console.log('----');
                // console.log(uri);
                // console.log(inputUri);
                // console.log(qualityUri);
                // console.log(originalUri);
              }
              catch (e) {
                console.warn('ERROR', e.message);
                throw e;
              }
              finally {
                console.log({
                  videoSegmentUri,
                  relativeStart,
                  relativeEnd,
                  orig: [originalInitialPTSTime, originalLastPTSTime],
                  clip: [clippedInitialPTSTime, clippedLastPTSTime]
                });
              }
            }
          }
        });
      }
      catch (e) {
        console.warn(e.message);
        throw e;
      }
    });

    // done();
  });
});
