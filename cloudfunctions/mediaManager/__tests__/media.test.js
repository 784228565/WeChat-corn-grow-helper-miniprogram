// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\mediaManager\__tests__\media.test.js
// Description: mediaManager 单元测试

const crypto = require('crypto');
const TOKEN_SECRET = 'farm-ledger-8x7k9m2p5n3q6r4t-v2026';

function makeToken(userId) {
  var header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  var body = Buffer.from(JSON.stringify({ userId: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  var sig = crypto.createHmac('sha256', TOKEN_SECRET).update(header + '.' + body).digest('base64url');
  return { token: header + '.' + body + '.' + sig };
}

jest.mock('wx-server-sdk', function() {
  return {
    init: jest.fn(),
    getTempFileURL: jest.fn(function(opts) {
      return Promise.resolve({
        fileList: opts.fileList.map(function(item) {
          return { fileID: item.fileID, tempFileURL: 'https://tmp.url/' + item.fileID, status: 0 };
        })
      });
    }),
    deleteFile: jest.fn(function() { return Promise.resolve({}); }),
    getWXContext: jest.fn(function() { return { OPENID: 'mock_openid' }; }),
    DYNAMIC_CURRENT_ENV: 'test-env'
  };
});

const { main } = require('../index');

describe('mediaManager', function() {
  test('TC-01: getTempUrls 返回临时链接', async function() {
    var res = await main({
      data: Object.assign({}, makeToken('u_user'), {
        action: 'getTempUrls',
        fileIds: ['cloud://test1.jpg', 'cloud://test2.jpg']
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.urls.length).toBe(2);
    expect(res.data.urls[0].url).toContain('https://tmp.url/');
  });

  test('TC-02: 空 fileIds 返回错误', async function() {
    var res = await main({
      data: Object.assign({}, makeToken('u_user'), {
        action: 'getTempUrls',
        fileIds: []
      })
    }, {});

    expect(res.success).toBe(false);
    expect(res.error.errCode).toBe('ERR_INVALID_PARAM');
  });

  test('TC-03: deleteFile 成功', async function() {
    var res = await main({
      data: Object.assign({}, makeToken('u_user'), {
        action: 'deleteFile',
        fileId: 'cloud://test.jpg'
      })
    }, {});

    expect(res.success).toBe(true);
    expect(res.data.deleted).toBe(true);
  });
});
