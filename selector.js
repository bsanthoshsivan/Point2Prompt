(function() {
  // Prevent multiple selection layers
  if (document.getElementById('claude-bridge-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'claude-bridge-overlay';
  overlay.style.cssText = `
    position: fixed; border: 2px solid #d97757; 
    background: rgba(217, 119, 87, 0.1); pointer-events: none; 
    z-index: 2147483647; transition: all 0.05s ease;
  `;
  document.body.appendChild(overlay);

  // Define cleanup function to reuse it
  const cleanupSelection = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onMove = (e) => {
    const rect = e.target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      cleanupSelection();
    }
  };

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const targetEl = e.target;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    cleanupSelection();
    createFloatingInput(mouseX, mouseY, targetEl);
  };

  function createFloatingInput(x, y, el) {
    const box = document.createElement('div');
    const boxWidth = 300;
    const boxHeight = 160;
    
    let posX = x + 10;
    let posY = y + 10;

    if (x + boxWidth > window.innerWidth) posX = x - boxWidth - 10;
    if (y + boxHeight > window.innerHeight) posY = y - boxHeight - 10;

    box.style.cssText = `
      position: fixed; left: ${posX}px; top: ${posY}px;
      width: ${boxWidth}px; background: #fff; border: 1px solid #d97757;
      padding: 15px; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.2);
      z-index: 2147483647; font-family: -apple-system, sans-serif;
      display: flex; flex-direction: column; gap: 10px;
    `;

    box.innerHTML = `
      <div style="font-size:11px; font-weight:700; color:#d97757; text-transform: uppercase;">Instruction for Claude</div>
      <textarea id="cl-input" placeholder="What should Claude change?" style="width:100%; height:70px; border:1px solid #eee; border-radius:6px; padding:8px; font-size:13px; resize:none; outline:none; box-sizing:border-box; background:#fcfcfc;"></textarea>
      <div style="display:flex; gap:8px;">
        <button id="cl-cancel" style="flex:1; background:#f0f0f0; color:#444; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Cancel</button>
        <button id="cl-send" style="flex:2; background:#d97757; color:#fff; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Send Prompt</button>
      </div>
    `;

    document.body.appendChild(box);
    const input = box.querySelector('#cl-input');
    input.focus();

    box.querySelector('#cl-send').onclick = () => {
      const instruction = input.value;
      if (!instruction) return;

      const selector = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase();
      const htmlSnippet = el.outerHTML.substring(0, 300);
      const prompt = `In this project, find the element "${selector}" (HTML: ${htmlSnippet}). Task: ${instruction}`;
      
      window.location.href = `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(prompt)}`;

      box.innerHTML = `<div style="color:#d97757; text-align:center; font-size:13px; padding: 10px; font-weight:600;">🚀 Sent! Auto-refreshing in 5s...</div>`;
      
      setTimeout(() => {
        box.remove();
        window.location.reload();
      }, 5000);
    };

    box.querySelector('#cl-cancel').onclick = () => box.remove();

    input.onkeydown = (e) => {
      if (e.key === 'Escape') box.remove();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { 
        box.querySelector('#cl-send').click();
      }
    };
  }

  // Initial event listeners for Selection Mode
  document.addEventListener('mousemove', onMove);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown);
})();