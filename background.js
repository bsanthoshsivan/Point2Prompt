// Background worker initialized

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["selector.js"]
  });
});

// Triggered when the icon is clicked
chrome.action.onClicked.addListener((tab) => {
  injectSelector(tab);
});

// Triggered when the keyboard shortcut is pressed
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "_execute_action") {
    injectSelector(tab);
  }
});