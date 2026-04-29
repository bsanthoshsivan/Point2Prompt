(function() {
  if (document.getElementById('cl-v2-panel')) return;

  let selectedElements = [];
  
  const panel = document.createElement('div');
  panel.id = 'cl-v2-panel';
  panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; width: 350px;
    background: #fff; border: 1px solid #d97757; border-radius: 6px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.25); z-index: 2147483647;
    font-family: -apple-system, sans-serif; display: flex; 
    flex-direction: column; overflow: hidden; user-select: none;
  `;

  panel.innerHTML = `
    <div id="cl-drag-handle" style="background:#d97757; color:white; padding:12px; font-weight:700; font-size:11px; display:flex; justify-content:space-between; align-items:center; cursor: move; letter-spacing: 0.5px;">
      <span>POINT 2 PROMPT V2</span>
      <span id="cl-count" style="background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">0 Items</span>
    </div>
    <div id="cl-list" style="max-height: 300px; overflow-y: auto; padding: 10px; background:#fcfcfc; display:flex; flex-direction:column; gap:10px; user-select: text;">
      <p style="font-size:12px; color:#999; text-align:center; padding: 20px 0;">Select items to reference them in your prompt.</p>
    </div>
    <div style="padding: 12px; border-top: 1px solid #eee; background: white; display: flex; flex-direction: column; gap: 8px; user-select: text;">
      <label style="font-size:10px; font-weight:700; color:#d97757; text-transform: uppercase;">Instructions (Ref by Item #)</label>
      <textarea id="cl-group-prompt" placeholder="e.g. 'Move Item 1 inside Item 2' or 'Make Item 3 look like Item 1'..." style="width:100%; height:70px; border:1px solid #ddd; border-radius:6px; padding:8px; font-size:12px; resize:none; outline:none; line-height:1.4;"></textarea>
      <div style="display:flex; gap:8px;">
        <button id="cl-cancel-all" style="flex:1; padding:10px; border:none; background:#eee; color:#444; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Cancel</button>
        <button id="cl-submit-all" style="flex:2; padding:10px; border:none; background:#d97757; color:white; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Send Logic to Claude</button>
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
    panel.style.transition = 'none';
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

    const existingIndex = selectedElements.findIndex(item => item.el === el);
    if (existingIndex !== -1) {
        // DESELECT: Remove the marker from the DOM
        selectedElements[existingIndex].marker.remove();
        
        // Remove from the array
        selectedElements.splice(existingIndex, 1);
        
        // RE-INDEX: Update remaining items so numbers (1, 2, 3...) stay sequential
        selectedElements.forEach((item, idx) => {
            const newIndex = idx + 1;
            item.index = newIndex;
            item.marker.innerText = newIndex;
            item.marker.setAttribute('data-cl-index', newIndex);
            item.selector = `${el.tagName.toLowerCase()} (Item ${newIndex})`;
        });
        
        renderList();
        return;
    }


    const index = selectedElements.length + 1;
    if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative';

    const marker = document.createElement('div');
    marker.className = 'cl-marker-badge';
    marker.setAttribute('data-cl-index', index);
    marker.style.cssText = `
      position: absolute; top: 0; left: 0;
      background: #d97757; color: white; width: 22px; height: 22px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 11px; z-index: 2147483645; font-weight: bold; pointer-events: none;
      transform: translate(-50%, -50%); border: 2px solid white;
    `;
    marker.innerText = index;
    el.appendChild(marker);



    const tag = el.tagName.toLowerCase();
    const textContent = el.innerText ? el.innerText.split('\n')[0].substring(0, 30).trim() : '';
    const parent = el.parentElement;
    const parentInfo = parent ? `${parent.tagName.toLowerCase()}${parent.className ? '.' + parent.className.split(' ')[0] : ''}` : 'none';
    const siblings = Array.from(parent ? parent.children : []);
    const siblingIndex = siblings.indexOf(el) + 1;

    // Build the referenceable path
    const selectorPath = `${tag} (Item ${index})`;

    selectedElements.push({ 
        index: index,
        el: el,
        selector: selectorPath, 
        html: el.outerHTML.substring(0, 800), // Larger snippet for better context
        text: textContent,
        parent: parentInfo,
        pos: siblingIndex,
        marker: marker, 
        individualPrompt: '' 
    });

    renderList();
  };



  



  function renderList() {
    const list = document.getElementById('cl-list');
    document.getElementById('cl-count').innerText = `${selectedElements.length} Items`;
    list.innerHTML = '';
    selectedElements.forEach((item, i) => {
      const itemDiv = document.createElement('div');
      itemDiv.style.cssText = 'background:white; padding:10px; border:1px solid #eee; border-radius:8px; display:flex; flex-direction:column; gap:4px; margin-bottom:4px;';
      itemDiv.innerHTML = `
        <div style="font-size:10px; font-weight:700; color:#d97757; display:flex; justify-content:space-between;">
            <span>ITEM ${item.index}: ${item.selector}</span>
            <span style="color:#999;">${item.text ? '"' + item.text + '"' : ''}</span>
        </div>
        <input type="text" class="cl-indiv-input" placeholder="Tweak specifically..." 
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
    // if (selectedElements.length === 0) return;


    const itemsContext = selectedElements.map((el) => {
        return `### REFERENCE: ITEM ${el.index}
        - Selector Path: ${el.selector}
        - Text Content: "${el.text}"
        - HTML Context: ${el.html}
        - Individual Note: ${el.individualPrompt || 'None'}`;
            }).join('\n\n---\n\n');


        let finalPrompt = "";

        // 2. Determine if we are in "Targeted" or "General" mode
        // if (selectedElements.length > 0) {
        //     // Targeted Mode: Provide specific HTML snippets
        //     const itemsContext = selectedElements.map(el => {
        //         return `[ITEM ${el.index}] 
        //         Selector: ${el.selector}
        //         Text: "${el.text}"
        //         Context: Parent is ${el.parent}, Sibling Position ${el.pos}
        //         Snippet: ${el.html}`;
        //                 }).join('\n\n---\n\n');
        //                 finalPrompt = `I have selected specific elements to modify:\n\n${itemsContext}\n\nINSTRUCTION: ${globalPrompt}`;
        //             } else {
        //                 // General Mode: Reference the page generally
        //                 finalPrompt = `GENERAL PAGE INSTRUCTION:\n${globalPrompt}\n\n(Note: No specific elements were selected. Apply this instruction to the overall context of the current file or component.)`;
        //     }

            if (selectedElements.length > 0) {
                  // Targeted Mode: Provide specific HTML snippets + Item-level prompts
                  const itemsContext = selectedElements.map(el => {
                      return `[ITEM ${el.index}] 
              Selector: ${el.selector}
              Text: "${el.text}"
              Context: Parent is ${el.parent}, Sibling Position ${el.pos}
              Snippet: ${el.html}
              ITEM-SPECIFIC INSTRUCTION: ${el.individualPrompt || 'Follow global instruction.'}`;
                  }).join('\n\n---\n\n');

                  finalPrompt = `I have selected specific elements to modify:\n\n${itemsContext}\n\nOVERALL GLOBAL INSTRUCTION: ${globalPrompt}`;
              } else {
                  // General Mode: Reference the page generally
                  finalPrompt = `GENERAL PAGE INSTRUCTION:\n${globalPrompt}\n\n(Note: No specific elements were selected. Apply this instruction to the overall context of the current file or component.)`;
            }


        // const finalPrompt = `I am using a visual selection tool. Please use the "ITEM #" references in my instructions to identify which elements I am talking about.
        
        // ${itemsContext}

        // USER INSTRUCTIONS:
        // ${globalPrompt}`;
        

        window.location.href = `vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(finalPrompt)}`;
        panel.innerHTML = `<div style="padding:30px; text-align:center; color:#d97757; font-weight:700;">🚀 LOGIC SENT!<br><span style="font-size:12px; font-weight:400; color:#666;">Applying changes...</span></div>`;
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