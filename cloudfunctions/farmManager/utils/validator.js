/**
 * 参数校验工具
 */

const { DENSITY_RANGE, COORDINATE_RANGE, SUPPORTED_CROPS } = require('../config');

/**
 * 校验农场名称
 */
function validateFarmName(name) {
  if (!name || typeof name !== 'string') return '农场名称不能为空';
  if (name.length > 50) return '农场名称不能超过 50 个字符';
  return null;
}

/**
 * 校验作物类型
 */
function validateCropType(cropType) {
  if (!cropType || typeof cropType !== 'string') return '作物类型不能为空';
  if (!SUPPORTED_CROPS.includes(cropType)) return '不支持的作物类型';
  return null;
}

/**
 * 校验地理位置坐标
 */
function validateCoordinates(lat, lng) {
  if (lat === undefined || lng === undefined) return null; // 坐标可选
  if (typeof lat !== 'number' || typeof lng !== 'number') return '坐标必须是数字';
  if (lat < COORDINATE_RANGE.LAT_MIN || lat > COORDINATE_RANGE.LAT_MAX) {
    return '纬度范围应为 -90 ~ +90';
  }
  if (lng < COORDINATE_RANGE.LNG_MIN || lng > COORDINATE_RANGE.LNG_MAX) {
    return '经度范围应为 -180 ~ +180';
  }
  return null;
}

/**
 * 校验种植密度
 * 合理范围：1000 ~ 100000 plants/acre
 */
function validateDensity(density) {
  if (density === undefined || density === null) return null; // 可选
  if (typeof density !== 'number') return '种植密度必须是数字';
  if (density < DENSITY_RANGE.MIN || density > DENSITY_RANGE.MAX) {
    return '种植密度应在 ' + DENSITY_RANGE.MIN + ' ~ ' + DENSITY_RANGE.MAX + ' 之间';
  }
  return null;
}

/**
 * 校验 farmId 格式
 */
function validateFarmId(farmId) {
  if (!farmId || typeof farmId !== 'string') return '农场 ID 不能为空';
  if (!/^f_[a-f0-9]{8}$/.test(farmId)) return '农场 ID 格式不正确';
  return null;
}

module.exports = {
  validateFarmName,
  validateCropType,
  validateCoordinates,
  validateDensity,
  validateFarmId,
};
