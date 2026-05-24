/**
 * 获取用户农场列表 Controller
 */

const Response = require('../utils/response');
const FarmService = require('../services/farmService');

async function handle(event, requestId) {
  const { includeArchived } = event;
  const farms = await FarmService.list(event.userId, includeArchived);
  return Response.success({ farms }, requestId);
}

module.exports = { handle };
