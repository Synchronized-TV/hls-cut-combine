const { expect } = require('chai');
const { getFileNameAtIndex, getBucketAndKey } = require('../utils');

describe('getFileNameFromIndex()', () => {
  it('should get filename from index', () => {
    const fileName = getFileNameAtIndex({
      index: 10,
      template: 'test-me-0000.txt'
    });

    expect(fileName).to.equal('test-me-0010.txt');
  });

  it('should get filename from index not starting at zero', () => {
    const fileName = getFileNameAtIndex({
      index: 10,
      template: 'test-me-0001.jpg'
    });

    expect(fileName).to.equal('test-me-0011.jpg');
  });

  it('should get filename from index with complex schemes', () => {
    const fileName = getFileNameAtIndex({
      index: 10,
      template: 's3://my-bucket/path/to/test-me-0001.jpg'
    });

    const fileName2 = getFileNameAtIndex({
      index: 10,
      template: 'http://my-site.com:8888/path/to/test-me-0001.jpg'
    });

    expect(fileName).to.equal('s3://my-bucket/path/to/test-me-0011.jpg');
    expect(fileName2).to.equal('http://my-site.com:8888/path/to/test-me-0011.jpg');
  });
});

describe('getBucketAndKey()', () => {
  it('should get bucket and key', () => {
    const [bucket, key] = getBucketAndKey('s3://my-bucket/path/to/file');

    expect(bucket).to.equal('my-bucket');
    expect(key).to.equal('path/to/file');
  });
});
