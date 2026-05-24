/**
 * 切换当前活跃农场 Controller
 */

const Response = require('../utils/response');
const Validator = require('../utils/validator');
const FarmService = require('../services/farmService');

async function handle(event, requestId) {
  const { farmId } = event;

  // 参数校验
  const err = Validator.validateFarmId(farmId);
  if (err) {
    return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);
  }

  const result = await FarmService.switchFarm(event.userId, farmId);
  return Response.success(result, requestId);
}

module.exports = { handle };
