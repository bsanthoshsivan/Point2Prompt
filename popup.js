document.getElementById('startBtn').addEventListener('click', async () => {
  const userPrompt = document.getElementById('promptInput').value;
  if (!userPrompt) {
    alert("Please enter an instruction first!");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    // func: injectSelector,
    func: startSelectionMode,
    args: [userPrompt]
  });

  window.close(); // Close the popup so you can see the page
});

function injectSelector(instruction) {
  // 1. Create a highlight overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; border:2px solid #d97757; background:rgba(217,119,87,0.1); pointer-events:none; z-index:2147483647; transition: all 0.1s ease;';
  document.body.appendChild(overlay);

  const onMove = (e) => {
    const rect = e.target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
  };

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    // Basic selector logic
    const selector = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase();
    const htmlSnippet = el.outerHTML.substring(0, 300);

    // Format final prompt for Claude Code
    const finalPrompt = `In the file for this preview, find the element "${selector}" (Snippet: ${htmlSnippet}). Task: ${instruction}, Do NOT rename existing classes or break disabled/loading states, Edit only the minimum required to complete the task`;


    // 2. Deep link to VS Code
    window.location.href = `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(finalPrompt)}`;

    // 3. Auto-Refresh Logic
    // Adjust 5000 (5 seconds) based on how fast Claude usually finishes for you
    setTimeout(() => {
      window.location.reload();
    }, 5000);

    // Cleanup
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('click', onClick, true);
    overlay.remove();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('click', onClick, true);
}

