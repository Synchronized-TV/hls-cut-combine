const { expect } = require('chai');
const path = require('path');
const qs = require('qs');
const url = require('url');
const {
  getClippedMediaPlaylist,
  getCombinedMediaPlaylist,
  getCombinedMasterPlaylist,
  getHlsJobs,
  executeJobs,
  playlistToString
} = require('../index');
const getFrames = require('./getFrames');

process.env.S3_PREFIX = 's3://s10d-dev-tf1/';
process.env.URI_PREFIX = 'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/';
process.env.JOB_FUNCTION_NAME = 'hlsClip';
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

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index += 1) {
    await callback(array[index], index, array); // eslint-disable-line
  }
}

describe('getClippedMediaPlaylist()', () => {
  it('should clip playlist between times', async () => {
    const playlist = await getClippedMediaPlaylist({
      key: 'test-cases/',
      start: 7,
      end: 13
    });

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:5.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00002--clip--1--6.ts
#EXTINF:1.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00003--clip--0--1.ts
#EXT-X-ENDLIST
`;

    expect(playlistToString(playlist)).to.be.equal(expected);
  });

  it('should clip longer playlist between times', async () => {
    const playlist = await getClippedMediaPlaylist({
      key: 'test-cases/',
      start: 7,
      end: 33
    });

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:5.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00002--clip--1--6.ts
#EXTINF:6.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00003.ts
#EXTINF:6.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00004.ts
#EXTINF:6.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00005.ts
#EXTINF:3.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00006--clip--0--3.ts
#EXT-X-ENDLIST
`;

    expect(playlistToString(playlist)).to.be.equal(expected);
  });

  it('should be correct at exact segment time', async () => {
    const playlist = await getClippedMediaPlaylist({
      key: 'test-cases/',
      start: 0,
      end: 4
    });

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:8
#EXT-X-MEDIA-SEQUENCE:1
#EXT-X-PLAYLIST-TYPE:VOD
#EXTINF:4.0000,
https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/playlist_00001--clip--0--4.ts
#EXT-X-ENDLIST
`;

    expect(playlistToString(playlist)).to.be.equal(expected);
  });

  it('should return all segments if over duration', async () => {
    const playlist = await getClippedMediaPlaylist({
      key: 'test-cases/',
      start: 0,
      end: 1000
    });

    const { length } = playlist.items.PlaylistItem;

    expect(playlist.items.PlaylistItem.length).to.be.equal(length);
  });
});

describe('getCombinedMasterPlaylist()', () => {
  it('should return master playlist from params', async () => {
    const params = [
      {
        key: 'test-cases/',
        start: 10,
        end: 28
      },
      {
        key: 'test-cases/',
        start: 12,
        end: 38
      }
    ];

    const playlist = await getCombinedMasterPlaylist(params);

    const expected = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=590320,AVERAGE-BANDWIDTH=590320,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=480x270,FRAME-RATE=25.000
?type=media&params%5B0%5D%5Bstart%5D=10&params%5B0%5D%5Bend%5D=28&params%5B0%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F270p_400k%2Fplaylist.m3u8&params%5B1%5D%5Bstart%5D=12&params%5B1%5D%5Bend%5D=38&params%5B1%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F270p_400k%2Fplaylist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=834719,AVERAGE-BANDWIDTH=834719,CODECS="avc1.4d401f,mp4a.40.5",RESOLUTION=640x360,FRAME-RATE=25.000
?type=media&params%5B0%5D%5Bstart%5D=10&params%5B0%5D%5Bend%5D=28&params%5B0%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F360p_600k%2Fplaylist.m3u8&params%5B1%5D%5Bstart%5D=12&params%5B1%5D%5Bend%5D=38&params%5B1%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F360p_600k%2Fplaylist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1509326,AVERAGE-BANDWIDTH=1509326,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=640x360,FRAME-RATE=25.000
?type=media&params%5B0%5D%5Bstart%5D=10&params%5B0%5D%5Bend%5D=28&params%5B0%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F360p_1200k%2Fplaylist.m3u8&params%5B1%5D%5Bstart%5D=12&params%5B1%5D%5Bend%5D=38&params%5B1%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F360p_1200k%2Fplaylist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3800419,AVERAGE-BANDWIDTH=3800419,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=25.000
?type=media&params%5B0%5D%5Bstart%5D=10&params%5B0%5D%5Bend%5D=28&params%5B0%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F540p_3500k%2Fplaylist.m3u8&params%5B1%5D%5Bstart%5D=12&params%5B1%5D%5Bend%5D=38&params%5B1%5D%5Buri%5D=https%3A%2F%2Fs3-eu-west-1.amazonaws.com%2Fs10d-dev-tf1%2Ftest-cases%2Fplaylist%2F540p_3500k%2Fplaylist.m3u8

`;

    expect(playlistToString(playlist)).to.deep.equal(expected);
  });
});

describe('getHlsJobs()', () => {
  it('should get hls jobs', async () => {
    const jobs = await getHlsJobs([
      { start: 0, end: 1, key: 'test-cases/' },
      { start: 10, end: 30, key: 'test-cases/' },
      { start: 0, end: 40, key: 'test-cases/' },
      { start: 0, end: 43, key: 'test-cases/' },
      { start: 20, end: 50, key: 'test-cases/' },
      { start: 200, end: 500, key: 'test-cases/' }
    ]);

    const expected = [
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00001.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00001--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00001.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00001--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00001.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00001--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00001.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00001--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00002.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00002--clip--4--6.ts',
        relativeStart: 4,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00002.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00002--clip--4--6.ts',
        relativeStart: 4,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00002.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00002--clip--4--6.ts',
        relativeStart: 4,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00002.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00002--clip--4--6.ts',
        relativeStart: 4,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00007.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00007--clip--0--4.ts',
        relativeStart: 0,
        relativeEnd: 4,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00007.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00007--clip--0--4.ts',
        relativeStart: 0,
        relativeEnd: 4,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00007.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00007--clip--0--4.ts',
        relativeStart: 0,
        relativeEnd: 4,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00007.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00007--clip--0--4.ts',
        relativeStart: 0,
        relativeEnd: 4,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00008.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00008--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00008.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00008--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00008.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00008--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00008.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00008--clip--0--1.ts',
        relativeStart: 0,
        relativeEnd: 1,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00004.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00004--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00009.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00009--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00004.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00004--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00009.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00009--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00004.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00004--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00009.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00009--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00004.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00004--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00009.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00009--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00034.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00034--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00084.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/270p_400k/playlist_00084--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=480:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 400000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00034.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00034--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00084.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_600k/playlist_00084--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 600000',
          '-level 3.1',
          '-b:a 64000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00034.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00034--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00084.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/360p_1200k/playlist_00084--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=640:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 1200000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00034.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00034--clip--2--6.ts',
        relativeStart: 2,
        relativeEnd: 6,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00084.ts',
        output: 's3://s10d-dev-tf1/test-cases/playlist/540p_3500k/playlist_00084--clip--0--2.ts',
        relativeStart: 0,
        relativeEnd: 2,
        outputOptions: [
          '-preset veryfast',
          '-filter:v scale=960:-1',
          '-framerate 25',
          '-profile:v main',
          '-b:v 3500000',
          '-level 3.1',
          '-b:a 96000',
          '-g 75',
          '-bf 3',
          '-muxdelay 0',
          '-muxpreload 0',
          '-streamid 0:481',
          '-streamid 1:482',
          '-movflags +faststart'
        ]
      }
    ];

    expect(jobs).to.deep.equal(expected);
  });
});

/*
describe('getCombinedMasterPlaylist()', () => {
  it('should clip playlist and execute jobs', async () => {
    const uris = [
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=38,43',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=2,4',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-videos/clean-settings/playlist.m3u8#t=44,49'
    ];

    const jobs = await getHlsJobs(uris);

    await executeJobs(jobs);
    const masterPlaylist = await getCombinedMasterPlaylist(uris);
    const streamItems = masterPlaylist.items.StreamItem;
    const allParams = streamItems.map(it => qs.parse(it.properties.uri, { arrayLimit: 9999 }));

    await asyncForEach(allParams, async (params) => {
      // try {
      const mediaPlaylist = await getCombinedMediaPlaylist(params.uris);
      const playlistItems = mediaPlaylist.items.PlaylistItem;
      const videoSegmentUris = playlistItems.map(it => it.properties.uri);

      await asyncForEach(videoSegmentUris, async (videoSegmentUri) => {
        if (videoSegmentUri.includes('--clip--')) {
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
            // try {
            expect(parseFloat(clippedStreams[0].duration)).to.equal(relativeEnd - relativeStart);

            if (relativeStart === 0) {
              expect(originalInitialPTSTime).to.equal(clippedInitialPTSTime);
              // console.info('OK');
              // console.log('OK');
              // console.log('a', originalInitialPTSTime, clippedInitialPTSTime);
            }

            if (relativeEnd === 6) {
              expect(originalLastPTSTime).to.equal(clippedLastPTSTime);
              // console.info('OK');
              // console.log('b', originalLastPTSTime, clippedLastPTSTime);
            }

            // console.log('originalInitialPTSTime', originalInitialPTSTime);
            // console.log('clippedInitialPTSTime', clippedInitialPTSTime);
            // console.log('----');
            // console.log(uri);
            // console.log(inputUri);
            // console.log(qualityUri);
            // console.log(originalUri);
            // }
            // catch (e) {
            //   console.warn('ERROR', e.message);
            //   throw e;
            // }
            // finally {
            //   console.log({
            //     videoSegmentUri,
            //     relativeStart,
            //     relativeEnd,
            //     orig: [originalInitialPTSTime, originalLastPTSTime],
            //     clip: [clippedInitialPTSTime, clippedLastPTSTime]
            //   });
            // }
          }
        }
      });
      // }
      // catch (e) {
      //   console.warn(e.message);
      //   throw e;
      // }
    });

    // done();
  });
});
*/
