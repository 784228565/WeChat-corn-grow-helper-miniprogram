// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\mediaManager\services\mediaService.js
// Description: 多媒体服务层

const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('../config');

const db = cloud.database();

/**
 * 批量获取云存储临时访问链接
 * @param {string[]} fileIds
 * @returns {Promise<object[]>}
 */
async function getTempUrls(fileIds) {
  if (!fileIds || fileIds.length === 0) return [];

  var res = await cloud.getTempFileURL({
    fileList: fileIds.map(function(id) { return { fileID: id, maxAge: 3600 }; })
  });

  return (res.fileList || []).map(function(item) {
    return {
      fileId: item.fileID,
      url: item.tempFileURL,
      status: item.status
    };
  });
}

/**
 * 删除云存储文件
 * @param {string} fileId
 */
async function deleteFile(fileId) {
  await cloud.deleteFile({ fileList: [fileId] });
}

/**
 * 获取某农场某阶段已上传的媒体文件数量
 * @param {string} farmId
 * @param {string} stage
 * @returns {Promise<number>}
 */
async function getUploadCount(farmId, stage) {
  var res = await db.collection(COLLECTIONS.MEDIA_RECORDS)
    .where({ farmId: farmId, stage: stage })
    .count();
  return res.total || 0;
}

/**
 * 记录上传的媒体文件（每阶段最多2次）
 * @param {string} userId
 * @param {string} farmId
 * @param {string} stage
 * @param {string} fileId
 * @param {string} fileType
 * @returns {Promise<object>}
 */
async function recordUpload(userId, farmId, stage, fileId, fileType) {
  // 并发防护：再次确认数量
  var countRes = await db.collection(COLLECTIONS.MEDIA_RECORDS)
    .where({ farmId: farmId, stage: stage })
    .count();
  if (countRes.total >= 2) {
    throw Object.assign(
      new Error('该阶段上传次数已达上限（最多2次）'),
      { code: 'ERR_UPLOAD_LIMIT_REACHED' }
    );
  }

  var now = new Date();
  var doc = {
    userId: userId,
    farmId: farmId,
    stage: stage,
    fileId: fileId,
    fileType: fileType,
    uploadedAt: now,
    createdAt: now
  };

  await db.collection(COLLECTIONS.MEDIA_RECORDS).add({ data: doc });

  return {
    farmId: farmId,
    stage: stage,
    fileId: fileId,
    fileType: fileType,
    uploadedAt: now.getTime()
  };
}

/**
 * 查询某农场某阶段已上传的媒体文件列表
 * @param {string} farmId
 * @param {string} stage
 * @returns {Promise<object[]>}
 */
async function listByStage(farmId, stage) {
  var res = await db.collection(COLLECTIONS.MEDIA_RECORDS)
    .where({ farmId: farmId, stage: stage })
    .orderBy('uploadedAt', 'desc')
    .get();
  return (res.data || []).map(function(item) {
    return {
      fileId: item.fileId,
      fileType: item.fileType,
      uploadedAt: item.uploadedAt ? item.uploadedAt.getTime() : 0
    };
  });
}

module.exports = {
  getTempUrls: getTempUrls,
  deleteFile: deleteFile,
  getUploadCount: getUploadCount,
  recordUpload: recordUpload,
  listByStage: listByStage
};
