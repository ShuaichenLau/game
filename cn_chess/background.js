/**
 * 后台 Service Worker：点击工具栏图标时，在新标签页中打开象棋游戏。
 */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
