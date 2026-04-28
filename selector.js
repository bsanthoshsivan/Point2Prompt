(function() {
  if (document.getElementById('cl-v2-panel')) return;

  let selectedElements = [];
  let isDragging = false;
  
  const panel = document.createElement('div');
  panel.id = 'cl-v2-panel';
  panel.style.cssText = `
    position: fixed; 
    bottom: 20px; 
    right: 20px; 
    width: 350px;
    background: #fff; 
    border: 1px solid #d97757; 
    border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25); z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
    display: flex; 
    flex-direction: column; 
    overflow: hidden; user-select: none;
  `;
  

  panel.innerHTML = `
    <div id="cl-drag-handle" style="background:#d97757; color:white; padding:12px; font-weight:700; font-size:11px; display:flex; justify-content:space-between; align-items:center; cursor: move; letter-spacing: 0.5px;">
      <span>POINT 2 PROMPT</span>
      <span id="cl-count" style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">0 Items</span>
    </div>
    <div id="cl-list" style="max-height: 250px; overflow-y: auto; padding: 10px; background:#fcfcfc; display:flex; flex-direction:column; gap:10px; user-select: text;">
      <p id="cl-placeholder" style="font-size:12px; color:#999; text-align:center; padding: 20px 0;">Select items or just type a global prompt.</p>
    </div>
    <div style="padding: 12px; border-top: 1px solid #eee; background: white; display: flex; flex-direction: column; gap: 8px; user-select: text;">
      <label style="font-size:10px; font-weight:700; color:#d97757; text-transform: uppercase;">Instructions</label>
      <textarea id="cl-group-prompt" placeholder="Global task or page context..." style="width:100%; height:60px; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:12px; resize:none; outline:none;"></textarea>
      <div style="display:flex; gap:8px;">
        <button id="cl-cancel-all" style="flex:1; padding:10px; border:none; background:#eee; color:#444; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Cancel</button>
        <button id="cl-submit-all" style="flex:2; padding:10px; border:none; background:#d97757; color:white; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Send to VS Code</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);



  const style = document.createElement('style');
  style.textContent = `
    /* The Bounce Animation */
    @keyframes cl-bounce {
      0% { transform: scale(1); }
      30% { transform: scale(0.92); }
      50% { transform: scale(1.08); }
      100% { transform: scale(1); }
    }
    
    /* The class we will toggle */
    .cl-bounce-active { 
      animation: cl-bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
      outline: 2px solid #d97757 !important;
      outline-offset: -2px;
    }
  `;
  document.head.appendChild(style);



  // --- VUE COMPONENT DISCOVERY (RECURSIVE) ---
  const getVueContext = (el) => {
    let elementComp = "Unknown-Component";
    let pageComp = "Unknown-Page";
    
    // 1. Recursive Climber to find the immediate Vue Component
    let current = el;
    while (current && current !== document.body) {
      // Check for Vue internal instance
      const vnode = current.__vnode__ || current.__vue_parent__;
      if (vnode) {
        const name = vnode.type?.name || vnode.type?.__name || vnode.type?.__file;
        if (name) {
          elementComp = name.split('/').pop().replace('.vue', '').split('?')[0];
          break;
        }
      }
      
      // Fallback: Check for Scoped CSS hash
      const scopedAttr = Array.from(current.attributes).find(a => a.name.startsWith('data-v-'));
      if (scopedAttr) {
        elementComp = `Hash-${scopedAttr.name.replace('data-v-', '')}`;
        break; 
      }
      current = current.parentElement;
    }

    // 2. Find Page Context (The top-most router-view child)
    const appRoot = document.getElementById('app') || document.body;
    // Look for the first major child of the app root
    const pageNode = Array.from(appRoot.children).find(c => c.__vnode__ || c.__vue_parent__ || c.tagName !== 'SCRIPT');
    if (pageNode) {
      const vnode = pageNode.__vnode__ || pageNode.__vue_parent__;
      const name = vnode?.type?.name || vnode?.type?.__name || vnode?.type?.__file;
      if (name) pageComp = name.split('/').pop().replace('.vue', '').split('?')[0];
    }

    return { elementComp, pageComp };
  };

  // --- UI DRAG & OVERLAY LOGIC ---
  const dragHandle = panel.querySelector('#cl-drag-handle');
  let offsetX, offsetY;
  dragHandle.addEventListener('mousedown', (e) => { isDragging = true; offsetX = e.clientX - panel.getBoundingClientRect().left; offsetY = e.clientY - panel.getBoundingClientRect().top; });
  document.addEventListener('mousemove', (e) => { if (!isDragging) return; panel.style.left = `${e.clientX - offsetX}px`; panel.style.top = `${e.clientY - offsetY}px`; panel.style.bottom = 'auto'; panel.style.right = 'auto'; });
  document.addEventListener('mouseup', () => { isDragging = false; });

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; border:2px solid #d97757; background:rgba(217,119,87,0.1); pointer-events:none; z-index:2147483646; display:none;';
  document.body.appendChild(overlay);

  document.addEventListener('mousemove', (e) => {
    if (panel.contains(e.target) || isDragging || e.target.classList.contains('cl-marker-badge')) { overlay.style.display = 'none'; return; }
    overlay.style.display = 'block';
    const rect = e.target.getBoundingClientRect();
    overlay.style.width = `${rect.width}px`; overlay.style.height = `${rect.height}px`;
    overlay.style.top = `${rect.top}px`; overlay.style.left = `${rect.left}px`;
  });

  // --- CLICK HANDLER ---
  const onClick = (e) => {
    if (panel.contains(e.target) || isDragging) return;
    e.preventDefault(); e.stopPropagation();

    const el = e.target;
    const existingIndex = selectedElements.findIndex(item => item.el === el);


    // --- ADD BOUNCE HERE ---
  el.classList.add('cl-bounce-active');
  
  // Remove the class after the animation ends so it can be re-triggered
  setTimeout(() => {
    el.classList.remove('cl-bounce-active');
  }, 400); 
  // -----------------------
  
    
    if (existingIndex !== -1) {
      selectedElements[existingIndex].marker.remove();
      selectedElements.splice(existingIndex, 1);
      selectedElements.forEach((item, idx) => { item.index = idx + 1; item.marker.innerText = item.index; });
      renderList();
      return;
    }

    const index = selectedElements.length + 1;
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';

    const marker = document.createElement('div');
    marker.className = 'cl-marker-badge';
    marker.style.cssText = `position:absolute; top:0; left:0; background:#d97757; color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; z-index:2147483645; font-weight:bold; transform:translate(-50%, -50%); border:2px solid white; pointer-events:none;`;
    marker.innerText = index;
    el.appendChild(marker);

    const context = getVueContext(el);

    const tag = el.tagName.toLowerCase();

    const textContent = el.innerText ? el.innerText.split('\n')[0].substring(0, 30).trim() : '';
    const parent = el.parentElement;
    const parentInfo = parent ? `${parent.tagName.toLowerCase()}${parent.className ? '.' + parent.className.split(' ')[0] : ''}` : 'none';
     const siblings = Array.from(parent ? parent.children : []);
    const siblingIndex = siblings.indexOf(el) + 1;

        // Build the referenceable path
    const selectorPath = `${tag} (Item ${index})`;

    selectedElements.push({
      index, el, marker,
      selector: selectorPath, 
      vueComp: context.elementComp,
      pageFile: context.pageComp,
      html: el.outerHTML.substring(0, 600),
      text: textContent,
        parent: parentInfo,
        pos: siblingIndex,

      individualPrompt: ''
    });

    renderList();
  };

  function renderList() {
    const list = document.getElementById('cl-list');
    document.getElementById('cl-count').innerText = `${selectedElements.length} Items`;
    if (selectedElements.length === 0) {
      list.innerHTML = `<p id="cl-placeholder" style="font-size:12px; color:#999; text-align:center; padding: 20px 0;">Select items or just type a global prompt.</p>`;
      return;
    }
    list.innerHTML = selectedElements.map((item, i) => `
      <div style="background:white; padding:8px; border:1px solid #eee; border-radius:8px; margin-bottom:4px;">
        <div style="font-size:10px; font-weight:700; color:#d97757;">${item.index}: ${item.vueComp+''} </div>
        <input type="text" class="cl-indiv-input" data-idx="${i}" placeholder="Specific tweak..." 
          style="width:100%; border:1px solid #eee; border-radius:4px; padding:4px; font-size:11px; outline:none;" 
          value="${item.individualPrompt}">
      </div>
    `).join('');

    list.querySelectorAll('.cl-indiv-input').forEach(input => {
      input.addEventListener('input', (e) => {
        selectedElements[e.target.dataset.idx].individualPrompt = e.target.value;
      });
    });
  }

  // --- SUBMIT LOGIC ---
  document.getElementById('cl-submit-all').onclick = (e) => {
    e.preventDefault();
    const globalPrompt = document.getElementById('cl-group-prompt').value;
    
    if (!globalPrompt.trim() && selectedElements.length === 0) {
        alert("Please select an item or type an instruction.");
        return;
    }

    const itemsContext = selectedElements.map(el => {
        return `[ITEM ${el.index}] 
        PAGE FILE: ${el.pageFile}.vue
        COMPONENT IDENTIFIER: ${el.vueComp}
        DOM SNIPPET: ${el.html}
        SPECIFIC TASK: ${el.individualPrompt || 'Follow global instruction'}`;
    }).join('\n\n---\n\n');

    const finalPrompt = `MODIFICATION REQUEST:
I am using a selection tool on my Vue dev site.
The user is currently on the "${selectedElements[0]?.pageFile || 'Current'}" page.

NOTE ON IDENTIFIERS: 
If an identifier starts with "Hash-", search for the scoped ID (e.g., grep "6dec5f19"). 
If it's a name, find the corresponding .vue file.

${itemsContext}

GLOBAL INSTRUCTION:
${globalPrompt}`;

    const encoded = encodeURIComponent(finalPrompt);
    window.location.assign(`vscode://anthropic.claude-code/open?prompt=${encoded}`);

    e.target.innerText = "Sent to IDE!";
    e.target.style.background = "#28a745";
    setTimeout(() => { cleanup(); window.location.reload(); }, 1500);
  };

  function cleanup() {
    document.removeEventListener('click', onClick, true);
    document.querySelectorAll('.cl-marker-badge').forEach(m => m.remove());
    overlay.remove(); panel.remove();
  }

  document.getElementById('cl-cancel-all').onclick = cleanup;
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cleanup(); }, { once: true });

})();