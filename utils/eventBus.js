/**
 * 轻量级事件总线
 * 用于跨页面/跨模块通信（如农场切换后通知任务模块刷新）
 */

var callbacks = {};

function on(event, fn) {
  if (typeof fn !== 'function') return;
  callbacks[event] = callbacks[event] || [];
  callbacks[event].push(fn);
}

function off(event, fn) {
  if (!callbacks[event]) return;
  if (!fn) {
    callbacks[event] = [];
    return;
  }
  var idx = callbacks[event].indexOf(fn);
  if (idx > -1) {
    callbacks[event].splice(idx, 1);
  }
}

function emit(event, data) {
  var fns = callbacks[event];
  if (!fns || fns.length === 0) return;
  fns.forEach(function(fn) {
    try {
      fn(data);
    } catch (e) {
      console.error('[eventBus] emit error:', e);
    }
  });
}

module.exports = {
  on: on,
  off: off,
  emit: emit
};
