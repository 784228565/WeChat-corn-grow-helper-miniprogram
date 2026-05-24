// Absolute Path: C:\Users\78422\WeChatProjects\checkin\cloudfunctions\mediaManager\utils\validator.js
// Description: 参数校验工具

function validateFileIds(fileIds) {
  if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) return 'fileIds 必须是非空数组';
  if (fileIds.length > 20) return '一次最多查询 20 个文件';
  return null;
}

function validateFileId(fileId) {
  if (!fileId || typeof fileId !== 'string') return 'fileId 不能为空';
  return null;
}

function validateUploadParams(data) {
  if (!data.farmId || typeof data.farmId !== 'string') return 'farmId 不能为空';
  if (!data.stage || typeof data.stage !== 'string') return 'stage 不能为空';
  if (!data.fileId || typeof data.fileId !== 'string') return 'fileId 不能为空';
  if (!data.fileType || (data.fileType !== 'image' && data.fileType !== 'video')) {
    return 'fileType 必须是 image 或 video';
  }
  return null;
}

function validateStageQuery(data) {
  if (!data.farmId || typeof data.farmId !== 'string') return 'farmId 不能为空';
  if (!data.stage || typeof data.stage !== 'string') return 'stage 不能为空';
  return null;
}

module.exports = {
  validateFileIds: validateFileIds,
  validateFileId: validateFileId,
  validateUploadParams: validateUploadParams,
  validateStageQuery: validateStageQuery
};
