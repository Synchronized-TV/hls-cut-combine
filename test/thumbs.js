const { expect } = require('chai');
const { getCombinedThumbsUris, getThumbsJobs } = require('../thumbs');

process.env.S3_PREFIX = 's3://s10d-dev-tf1/';
process.env.URI_PREFIX = 'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/';
process.env.THUMB_TEMPLATE = 'thumbs/thumb.0000000.jpg';
process.env.THUMB_COMBINED_PREFIX = 'thumbs/thumb';
process.env.THUMB_DURATION = 20;

describe('getCombinedThumbsUris()', () => {
  it('should get thumbs uris', () => {
    const thumbs = getCombinedThumbsUris([
      { start: 0, end: 1, key: 'test-cases/' },
      { start: 10, end: 30, key: 'test-cases/' },
      { start: 0, end: 40, key: 'test-cases/' },
      { start: 0, end: 43, key: 'test-cases/' },
      { start: 20, end: 50, key: 'test-cases/' },
      { start: 200, end: 500, key: 'test-cases/' }
    ]);

    const expected = [
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--1.jpg',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--10--30.jpg',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--40.jpg',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--43.jpg',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--20--50.jpg',
      'https://s3-eu-west-1.amazonaws.com/s10d-dev-tf1/test-cases/thumbs/thumb--combine--200--500.jpg'
    ];

    expect(thumbs).to.deep.equal(expected);
  });
});

describe('getThumbsJobs()', () => {
  it('should get thumbs jobs', () => {
    const jobs = getThumbsJobs([
      { start: 0, end: 1, key: 'test-cases/' },
      { start: 10, end: 30, key: 'test-cases/' },
      { start: 0, end: 40, key: 'test-cases/' },
      { start: 0, end: 43, key: 'test-cases/' },
      { start: 20, end: 50, key: 'test-cases/' },
      { start: 200, end: 500, key: 'test-cases/' }
    ]);

    const expected = [
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--1.jpg',
        fromIndex: 0,
        toIndex: 1
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--10--30.jpg',
        fromIndex: 1,
        toIndex: 2
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--40.jpg',
        fromIndex: 0,
        toIndex: 2
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--0--43.jpg',
        fromIndex: 0,
        toIndex: 3
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--20--50.jpg',
        fromIndex: 1,
        toIndex: 3
      },
      {
        input: 's3://s10d-dev-tf1/test-cases/thumbs/thumb.0000000.jpg',
        output: 's3://s10d-dev-tf1/test-cases/thumbs/thumb--combine--200--500.jpg',
        fromIndex: 10,
        toIndex: 25
      }
    ];

    expect(jobs).to.deep.equal(expected);
  });
});
