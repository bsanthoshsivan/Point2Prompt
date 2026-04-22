(function() {
  if (document.getElementById('cl-v2-panel')) return;

  let selectedElements = [];
  
  // 1. Create the Global UI
  const panel = document.createElement('div');
  panel.id = 'cl-v2-panel';
  panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; width: 350px;
    background: #fff; border: 1px solid #d97757; border-radius: 12px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25); z-index: 2147483647;
    font-family: -apple-system, sans-serif; display: flex; 
    flex-direction: column; overflow: hidden; user-select: none;
  `;

  // Draggable Header
  panel.innerHTML = `
    <div id="cl-drag-handle" style="background:#d97757; color:white; padding:12px; font-weight:700; font-size:11px; display:flex; justify-content:space-between; align-items:center; cursor: move; letter-spacing: 0.5px;">
      <span>POINT 2 PROMPT</span>
      <span id="cl-count" style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">0 Items</span>
    </div>
    <div id="cl-list" style="max-height: 300px; overflow-y: auto; padding: 10px; background:#fcfcfc; display:flex; flex-direction:column; gap:10px; user-select: text;">
      <p style="font-size:12px; color:#999; text-align:center; padding: 20px 0;">Click UI elements to start marking...</p>
    </div>
    <div style="padding: 12px; border-top: 1px solid #eee; background: white; display: flex; flex-direction: column; gap: 8px; user-select: text;">
      <label style="font-size:10px; font-weight:700; color:#999; text-transform: uppercase;">Global Instruction</label>
      <textarea id="cl-group-prompt" placeholder="Apply to all items..." style="width:100%; height:50px; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:12px; resize:none; outline:none;"></textarea>
      <div style="display:flex; gap:8px;">
        <button id="cl-cancel-all" style="flex:1; padding:10px; border:none; background:#eee; color:#444; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Cancel</button>
        <button id="cl-submit-all" style="flex:2; padding:10px; border:none; background:#d97757; color:white; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Send to Claude</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // --- DRAG LOGIC ---
  const dragHandle = panel.querySelector('#cl-drag-handle');
  let isDragging = false;
  let offsetX, offsetY;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
    panel.style.transition = 'none'; // Disable transition while dragging
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top = `${e.clientY - offsetY}px`;
    panel.style.bottom = 'auto'; // Remove bottom constraint
    panel.style.right = 'auto';  // Remove right constraint
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // --- SELECTION LOGIC ---
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; border:2px solid #d97757; background:rgba(217,119,87,0.1); pointer-events:none; z-index:2147483646; display:none;';
  document.body.appendChild(overlay);

  const onMouseMove = (e) => {
    if (panel.contains(e.target) || isDragging) { 
      overlay.style.display = 'none'; 
      return; 
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
    const rect = el.getBoundingClientRect();
    
    const marker = document.createElement('div');
    marker.className = 'cl-marker-badge';
    marker.style.cssText = `
      position: absolute; top: ${rect.top + window.scrollY}px; left: ${rect.left + window.scrollX}px;
      background: #d97757; color: white; width: 22px; height: 22px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 11px; z-index: 2147483645; font-weight: bold; pointer-events: none;
    `;
    marker.innerText = index;
    document.body.appendChild(marker);

    const selector = el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase();
    selectedElements.push({ selector, html: el.outerHTML.substring(0, 300), marker, individualPrompt: '' });

    renderList();
  };

  function renderList() {
    const list = document.getElementById('cl-list');
    document.getElementById('cl-count').innerText = `${selectedElements.length} Items`;
    list.innerHTML = '';
    selectedElements.forEach((item, i) => {
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'background:white; padding:10px; border:1px solid #eee; border-radius:8px; display:flex; flex-direction:column; gap:6px;';
      itemDiv.innerHTML = `
        <div style="font-size:10px; font-weight:700; color:#d97757;">ITEM ${i+1}: ${item.selector}</div>
        <input type="text" class="cl-indiv-input" data-index="${i}" placeholder="Specific change..." 
          style="width:100%; border:1px solid #eee; border-radius:4px; padding:6px; font-size:12px; outline:none;" 
          value="${item.individualPrompt}">
      `;
      list.appendChild(itemDiv);
      itemDiv.querySelector('.cl-indiv-input').addEventListener('input', (e) => {
        selectedElements[i].individualPrompt = e.target.value;
      });
    });
  }

  document.getElementById('cl-submit-all').onclick = () => {
    const globalPrompt = document.getElementById('cl-group-prompt').value;
    if (selectedElements.length === 0) return;
    const itemsContext = selectedElements.map((el, i) => `[Item ${i+1}] Selector: ${el.selector}\nTask: ${el.individualPrompt || 'Follow global'}`).join('\n\n');
    const finalPrompt = `MULTI-ELEMENT UPDATE:\n${itemsContext}\n\nGLOBAL INSTRUCTION: ${globalPrompt}`;
    window.location.href = `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(finalPrompt)}`;
    panel.innerHTML = `<div style="padding:30px; text-align:center; color:#d97757; font-weight:700;">🚀 Sent! Refreshing...</div>`;
    setTimeout(() => { cleanup(); window.location.reload(); }, 5000);
  };

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