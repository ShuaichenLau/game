/**
 * 兼容入口：仅用于 Node 脚本 / 测试聚合导出
 * 浏览器端请直接使用 js/ 下的模块（index.html 不再引用本文件）
 */
const Constants = require('./js/constants.js');
const Rules = require('./js/rules.js');
const AI = require('./js/ai.js');

module.exports = Object.assign({}, Constants, Rules, AI);
