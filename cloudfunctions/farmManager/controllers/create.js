/**
 * 创建新农场 Controller
 */

const Response = require('../utils/response');
const Validator = require('../utils/validator');
const FarmService = require('../services/farmService');

async function handle(event, requestId) {
  const { name, cropType, location, fullName, phone, accumulatedTemp, soilType, irrigation, plantingDensity, seedVariety, rowSpacing } = event;
  console.log('[farmManager/create] received fields:', { accumulatedTemp, soilType, irrigation });

  // 参数校验
  let err = Validator.validateFarmName(name);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  err = Validator.validateCropType(cropType);
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  err = Validator.validateCoordinates(
    location ? location.latitude : undefined,
    location ? location.longitude : undefined
  );
  if (err) return Response.fail('ERR_INVALID_PARAM', err, 'fallback', requestId);

  // 种植密度阈值校验（代码审查关注点）
  err = Validator.validateDensity(plantingDensity);
  if (err) return Response.fail('ERR_INVALID_DENSITY', err, 'fallback', requestId);

  const data = {
    name,
    cropType,
    location,
    fullName,
    phone,
    accumulatedTemp,
    soilType,
    irrigation,
    plantingDensity,
    seedVariety,
    rowSpacing,
  };

  try {
    const result = await FarmService.create(event.userId, data);
    return Response.success(result, requestId);
  } catch (err) {
    if (err.code === 'ERR_FARM_LIMIT_REACHED') {
      return Response.fail(err.code, err.message, 'fallback', requestId);
    }
    throw err;
  }
}

module.exports = { handle };
