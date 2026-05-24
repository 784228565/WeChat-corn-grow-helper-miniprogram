/**
 * 获取农场详情 Controller
 */

const Response = require('../utils/response');
const Validator = require('../utils/validator');
const FarmService = require('../services/farmService');

async function handle(event, requestId) {
  const { farmId } = event;

  const err = Validator.validateFarmId(farmId);
  if (err) {
    return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  }

  const farm = await FarmService.detail(event.userId, farmId);
  return Response.success({ farm }, requestId);
}

module.exports = { handle };
