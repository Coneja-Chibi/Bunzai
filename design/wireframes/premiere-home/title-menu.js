/** A3/Persona selection-driven title menu: roving keys, large commands, and one changing preview. */
const commands = [...document.querySelectorAll('.command')];
const preview = document.getElementById('selection-preview');
const kicker = document.getElementById('preview-kicker');
const stats = rows => `<div class="stats">${rows.map(([label,value])=>`<div class="stat"><span>${label}</span><i></i><b>${value}</b></div>`).join('')}</div>`;
const open = (label, target) => `<a class="open-selection" href="#${target}"><span>${label}</span><span aria-hidden="true">↗</span></a>`;
const shelf = rows => `<div class="shelf">${rows.map(([initial,label,detail,target])=>`<a href="#${target}"><span class="item-mark">${initial}</span><span><b>${label}</b><small>${detail}</small></span><span aria-hidden="true">↗</span></a>`).join('')}</div>`;
const previews = {
  continue: ['Continue your story', `<div class="scene-picture"><span class="picture-caption">Act II · The last letter</span><span class="scene-number">SCENE<br><b>07</b></span></div><div class="window-body"><span class="eyebrow gilt">Now playing</span><h2 id="preview-title">The Paper Moon</h2><p class="scene-quote">“The envelope is warm. Your name is written on it in your own handwriting.”</p>${stats([['Cast','3 characters'],['Take','The main branch'],['Last played','Yesterday']])}${open('Return to the scene','resume')}<a class="load-link" href="#scenes">Choose another story <span>→</span></a></div>`],
  new: ['A new production', `<div class="window-body"><span class="eyebrow gilt">An empty stage. All yours.</span><h2 id="preview-title">Where do we begin?</h2><p>Name your story, choose a cast, and set the opening scene.</p><div class="new-scene-art"><span>ACT I</span><b>The first scene</b><i>Not a word written yet.</i></div>${stats([['Story','Untitled'],['Cast','You decide'],['Direction','Anywhere']])}${open('Raise a new curtain','new-story')}</div>`],
  library: ['Your collection', `<div class="window-body"><span class="eyebrow gilt">People. Places. Possibilities.</span><h2 id="preview-title">The Library</h2><p>Everything you've gathered, ready for its next role.</p>${shelf([['C','Cast & personas','Who takes the stage','cast'],['W','Worlds & lorebooks','What they know and where they live','worlds'],['P','Presets & prompts','The voice behind the scene','workbench']])}${open('Open the library','library')}<a class="load-link" href="#import">Import an existing piece <span>→</span></a></div>`],
  workbench: ['At the writing desk', `<div class="window-body"><span class="eyebrow gilt">Every detail matters</span><h2 id="preview-title">The Workbench</h2><p>Open a piece and shape its fields, prompts, and supporting knowledge.</p><div class="editor-preview"><span class="eyebrow">Mira, the letter carrier</span><div><span>Description</span><p>A quiet courier who delivers letters nobody remembers writing.</p></div><div><span>First message</span><p>The envelope is warm...</p></div></div>${open('Open the workbench','workbench')}</div>`],
  press: ['Ready for another stage', `<div class="window-body"><span class="eyebrow gilt">Your work travels with you</span><h2 id="preview-title">The Press</h2><p>Take staged pieces to another format, with their linked lorebooks alongside them.</p>${shelf([['01','Mira, the letter carrier','Character + linked lorebook','workbench']])}${stats([['Staged','1 piece'],['Linked','1 lorebook'],['Target','Choose a format']])}${open('Visit the press','press')}</div>`],
  settings: ['Set the atmosphere', `<div class="window-body"><span class="eyebrow gilt">Make the theater yours</span><h2 id="preview-title">Settings</h2><p>Tune the appearance and connections behind your studio.</p>${stats([['Lighting','Follows the mouse'],['Fog','Soft, rolling'],['Motion','Respects your preferences']])}${open('Open settings','settings')}</div>`],
  help: ['A look behind the curtain', `<div class="window-body"><span class="eyebrow gilt">Everyone starts somewhere</span><h2 id="preview-title">Backstage guide</h2><p>Find your way through stories, cast, worlds, editing and export.</p>${shelf([['I','Start a story','Gather a cast and set the scene','new-story'],['II','Bring your pieces','Import something you already have','import'],['III','Learn the rooms','What goes where, and why','help']])}${open('Open the guide','help')}</div>`],
};
let selected = 0;
function select(index) {
  selected = index;
  commands.forEach((command,i)=>{command.classList.toggle('selected',i===index);command.tabIndex=i===index?0:-1;});
  const content=previews[commands[index].dataset.preview];
  kicker.textContent=content[0]; preview.innerHTML=content[1];
  document.querySelector('.preview-window').scrollTop=0;
  document.querySelector('.window-index').textContent=`0${index+1} / 07`;
}
commands.forEach((command,index)=>{
  command.addEventListener('pointerenter',()=>select(index));
  command.addEventListener('focus',()=>select(index));
});
document.addEventListener('keydown',event=>{
  if(dialog.open||event.altKey||event.ctrlKey||event.metaKey||event.target.matches('input,textarea,select'))return;
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();
  const next=event.key==='Home'?0:event.key==='End'?commands.length-1:(selected+(event.key==='ArrowDown'?1:-1)+commands.length)%commands.length;
  select(next); commands[next].focus({preventScroll:true});
});
select(0);
