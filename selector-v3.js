(function() {
  if (document.getElementById('cl-v2-panel')) return;

  let selectedElements = [];
  let isDragging = false;
  
  // 1. Create the Global UI
  const panel = document.createElement('div');
  panel.id = 'cl-v2-panel';
  panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; width: 350px;
    background: #fff; border: 1px solid #d97757; border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25); z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    display: flex; flex-direction: column; overflow: hidden; user-select: none;
  `;

  panel.innerHTML = `
    <div id="cl-drag-handle" style="background:#d97757; color:white; padding:12px; font-weight:700; font-size:11px; display:flex; justify-content:space-between; align-items:center; cursor: move; letter-spacing: 0.5px;">
      <span>CLAUDE POINT & EDIT V3.2</span>
      <span id="cl-count" style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">0 Items</span>
    </div>
    <div id="cl-list" style="max-height: 300px; overflow-y: auto; padding: 10px; background:#fcfcfc; display:flex; flex-direction:column; gap:10px; user-select: text;">
      <p id="cl-placeholder" style="font-size:12px; color:#999; text-align:center; padding: 20px 0;">Click elements to start Stage 1 (Ghosting)...</p>
    </div>
    <div id="cl-footer" style="padding: 12px; border-top: 1px solid #eee; background: white; display: flex; flex-direction: column; gap: 8px; user-select: text;">
      <label style="font-size:10px; font-weight:700; color:#d97757; text-transform: uppercase;">Visual Instruction</label>
      <textarea id="cl-group-prompt" placeholder="Describe the look (e.g. 'Make this a dark mode card')..." style="width:100%; height:70px; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:12px; resize:none; outline:none; line-height:1.4;"></textarea>
      <div style="display:flex; gap:8px;">
        <button id="cl-cancel-all" style="flex:1; padding:10px; border:none; background:#eee; color:#444; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Cancel</button>
        <button id="cl-ghost-btn" style="flex:2; padding:10px; border:none; background:#d97757; color:white; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Preview Visuals</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // --- HELPER: PROTOCOL DISPATCHER ---
  const sendToVSCode = (prompt) => {
    const encoded = encodeURIComponent(prompt);
    const url = `vscode://anthropic.claude-code/open?prompt=${encoded}`;
    
    // Fallback for long URLs: If over 3000 chars, alert user
    if (url.length > 3500) {
        alert("Selection too complex! Try selecting fewer items or shorter prompts.");
        return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
  };

  // --- DRAG LOGIC ---
  const dragHandle = panel.querySelector('#cl-drag-handle');
  let offsetX, offsetY;
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top = `${e.clientY - offsetY}px`;
    panel.style.bottom = 'auto'; panel.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });

  // --- SELECTION LOGIC ---
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; border:2px solid #d97757; background:rgba(217,119,87,0.1); pointer-events:none; z-index:2147483646; display:none;';
  document.body.appendChild(overlay);

  const onMouseMove = (e) => {
    if (panel.contains(e.target) || isDragging || e.target.classList.contains('cl-marker-badge')) { 
      overlay.style.display = 'none'; return; 
    }
    overlay.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`; overlay.style.left = `${rect.left}px`;
  };

  const onClick = (e) => {
    if (panel.contains(e.target) || isDragging) return;
    e.preventDefault(); e.stopPropagation();

    const el = e.target;
    const index = selectedElements.length + 1;
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';

    const marker = document.createElement('div');
    marker.className = 'cl-marker-badge';
    marker.style.cssText = `
      position: absolute; top: 0; left: 0; background: #d97757; color: white; width: 22px; height: 22px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;
      z-index: 2147483645; font-weight: bold; transform: translate(-50%, -50%); border: 2px solid white;
    `;
    marker.innerText = index;
    el.appendChild(marker);

    selectedElements.push({ 
        index: index,
        selector: `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ')[0] : ''} (#${index})`, 
        html: el.outerHTML.substring(0, 400), // Reduced snippet size for URL stability
        marker: marker, 
        individualPrompt: '' 
    });

    renderList();
  };

  function renderList() {
    const list = document.getElementById('cl-list');
    document.getElementById('cl-count').innerText = `${selectedElements.length} Items`;
    const placeholder = document.getElementById('cl-placeholder');
    if (placeholder) placeholder.remove();

    list.innerHTML = selectedElements.map((item, i) => `
      <div style="background:white; padding:8px; border:1px solid #eee; border-radius:8px; margin-bottom:4px;">
        <div style="font-size:10px; font-weight:700; color:#d97757;">ITEM ${item.index}: ${item.selector}</div>
        <input type="text" class="cl-indiv-input" data-idx="${i}" placeholder="Tweak visually..." 
          style="width:100%; border:1px solid #eee; border-radius:4px; padding:4px; font-size:12px; outline:none;" 
          value="${item.individualPrompt}">
      </div>
    `).join('');

    list.querySelectorAll('.cl-indiv-input').forEach(input => {
      input.addEventListener('input', (e) => {
        selectedElements[e.target.dataset.idx].individualPrompt = e.target.value;
      });
    });
  }

  // --- ACTION: GHOST PREVIEW ---
  document.getElementById('cl-ghost-btn').onclick = (e) => {
    const prompt = document.getElementById('cl-group-prompt').value;
    if (selectedElements.length === 0 || !prompt) return;

    const itemsContext = selectedElements.map(el => {
        return `ITEM ${el.index}: ${el.selector} - Task: ${el.individualPrompt || 'N/A'}\nSnippet: ${el.html}`;
    }).join('\n\n');

    const ghostPrompt = `STAGE 1: VISUAL GHOSTING\nDesign Task: ${prompt}\n\nContext:\n${itemsContext}`;

    sendToVSCode(ghostPrompt);
    showCommitUI(prompt);
  };

  function showCommitUI(originalPrompt) {
    const list = document.getElementById('cl-list');
    const footer = document.getElementById('cl-footer');
    
    list.innerHTML = `
      <div style="padding:20px; text-align:center;">
        <div style="font-size:24px; margin-bottom:10px;">🎨</div>
        <div style="font-size:13px; font-weight:bold; color:#d97757;">GHOSTING IN PROGRESS</div>
        <p style="font-size:11px; color:#666; margin-top:8px;">Check VS Code. Once design is ready, click 'Final Commit'.</p>
      </div>
    `;

    footer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button id="cl-commit" style="padding:12px; border:none; background:#28a745; color:white; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">Final Commit (Clean Code)</button>
        <button id="cl-discard" style="padding:10px; border:1px solid #ddd; background:white; color:#666; border-radius:6px; cursor:pointer; font-size:11px;">Discard Design</button>
      </div>
    `;

    document.getElementById('cl-discard').onclick = () => window.location.reload();

    document.getElementById('cl-commit').onclick = () => {
      const finalPrompt = `STAGE 2: FINAL COMMIT\nFinalize styling and logic for original task: ${originalPrompt}`;
      sendToVSCode(finalPrompt);
      document.getElementById('cl-v2-panel').innerHTML = `<div style="padding:30px; text-align:center; color:#28a745; font-weight:700;">Finalizing...</div>`;
      setTimeout(() => window.location.reload(), 5000);
    };
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('click', onClick, true);
    document.querySelectorAll('.cl-marker-badge').forEach(m => m.remove());
    overlay.remove(); panel.remove();
  }

  document.getElementById('cl-cancel-all').onclick = cleanup;
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cleanup(); }, { once: true });

})();