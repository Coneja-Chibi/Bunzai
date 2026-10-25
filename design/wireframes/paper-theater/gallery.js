/** Navigation and explicitly simulated interactions for the paper-theater design gallery. */
const screenPick = document.querySelector('#screen-pick');
const statePick = document.querySelector('#state-pick');
const app = document.querySelector('#app');
const screen = document.querySelector('#screen');
const dockItems = ['home','scenes','library','workbench','press','agent','themes','settings'];
const screenOrder = ['title','home','library','import','trash','scenes','scene','chapters','choices','trackhare','replay','workbench','lorebook','preset','persona','regex','sprites','quickreply','document','history','press','agent','cost','themes','addons','setup','settings','gate','tools','foundations'];
screenPick.innerHTML = screenOrder.map(id=>`<option value="${id}">${PaperScreens[id].title}</option>`).join('');
document.querySelector('#brand-bun').innerHTML = PaperArt.bunny();
const query = new URLSearchParams(location.search);
statePick.value = ['ready','empty','loading','error'].includes(query.get('state')) ? query.get('state') : 'ready';
if (query.get('width') === 'phone') app.classList.add('phone');
let feedbackTimer;
function showFeedback(message) {
  const el = document.querySelector('#feedback'); el.textContent = message; el.classList.add('visible');
  clearTimeout(feedbackTimer); feedbackTimer = setTimeout(()=>el.classList.remove('visible'),4200);
}
function showDialog(title, content) {
  document.querySelector('#dialog-content').innerHTML = `<h2>${title}</h2>${content}<p class="small-text rule">Design preview. No app data is changed.</p>`;
  document.querySelector('#preview-dialog').showModal();
}
function currentScreen() { return PaperScreens[location.hash.slice(1)] ? location.hash.slice(1) : 'title'; }
function render() {
  const id = currentScreen(), config = PaperScreens[id], state = statePick.value;
  screenPick.value = id; app.classList.toggle('title-mode',id==='title');
  document.querySelector('#dock').innerHTML = dockItems.map(key=>`<a href="#${key}" class="${key===id ? 'active' : ''}" ${key===id?'aria-current="page"':''}>${PaperArt.icon(PaperScreens[key].icon)}${key==='home'?'Home':key==='workbench'?'Workbench':PaperScreens[key].title}</a>`).join('');
  if (state === 'ready') screen.innerHTML = `<div class="${id==='title'?'':'room'}">${config.render()}</div>`;
  else {
    const stateCopy = {empty:['A little room for something new.','Nothing here yet. Start a piece or bring a story inside.'],loading:['Setting the little stage.','Loading your library. Your saved stories stay where they are.'],error:['A string came loose.','This screen could not load. Your saved work has not been replaced.']}[state];
    screen.innerHTML = `<div class="room">${PT.head(config.title,'Design state: '+state)}<section class="empty sheet fold">${PaperArt.icon(config.icon)}<h2>${stateCopy[0]}</h2><p>${stateCopy[1]}</p>${PT.button(state==='error'?'Try again':state==='empty'?'Start here':'Show ready state','ready','primary')}${PT.link('Library','library','quiet')}</section></div>`;
  }
  document.querySelector('#review-note').innerHTML = `<strong>${config.title}.</strong> ${config.note} <a href="#foundations">Visual language</a> · <a href="DECISIONS.md">Decisions & coverage</a>`;
  document.title = `Bunraku · ${config.title} · Paper theater`;
}
window.addEventListener('hashchange',render);
screenPick.addEventListener('change',()=>{location.hash = screenPick.value;});
statePick.addEventListener('change',render);
document.querySelector('#theme-pick').addEventListener('click',e=>{
  const light = document.documentElement.dataset.theme !== 'paper'; document.documentElement.dataset.theme = light?'paper':'stage';
  e.currentTarget.textContent = light?'Back to dark paper':'Daylight comparison'; e.currentTarget.setAttribute('aria-pressed',String(light));
});
document.querySelector('#width-pick').addEventListener('click',e=>{
  const phone = app.classList.toggle('phone'); e.currentTarget.textContent = phone?'Desktop width':'Phone width'; e.currentTarget.setAttribute('aria-pressed',String(phone));
});
document.addEventListener('keydown',e=>{
  if(e.key==='Enter' && currentScreen()==='title' && !['INPUT','SELECT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)) location.hash='home';
});
const previews = {
  'piece-menu':['Piece menu','<div class="stack">Open · Open beside · Duplicate · Stage for Press · Rename · Move to Trash</div><p>Set pieces also expose their existing switch, Split and Copy actions.</p>'],
  'message-menu':['Message actions','<p>Edit · Copy · Branch from here · Delete this message · Delete this & all after</p><p>Cuts retain a Restore line for the retention window.</p>'],
  takes:['Choose a take','<p>Director’s Cut · Take 2 · Rename · Branch · Move take to Trash</p>'],
  cast:['Cast & character growth','<p>Vera v12 · persona Rieta · compare versions · use saved version.</p><p>Model-proposed growth belongs in a separate field-review flow.</p>'+PT.link('Growth & history study','history')],
  world:['World wing','<p>Keeper’s Log · enabled · 182 entries</p><p>Books, entry editing, trigger settings, timing, activation reasons and New Lorebook stay available.</p>'+PT.link('Open binder study','lorebook')],
  prompting:['Prompting wing','<p>Preset picker · sampler · prompt groups · per-scene overrides · Guides · Scene Note.</p>'+PT.link('Open preset study','preset')],
  ai:['AI wing','<p>Your saved connection · model · provider settings · manage connection.</p><p>No real keys are requested in this preview.</p>'],
  props:['Props wing',PT.link('Props & add-ons','addons')+PT.link('TrackHare','trackhare')],
  booth:['Control Booth','<p>Scene controls and the shared TrackHare health findings.</p>'+PT.link('Open TrackHare','trackhare')],
  'composer-tools':['Composer tools','<p>Scene Note · Guides · hide from AI · draft impersonation · Continue</p><p>These are proposed controls where not already available.</p>'],
  'ingest-lore':['Review proposed entries','<p><strong>The second ledger</strong></p><p>Vera’s mother appears in two entries dated twenty years apart.</p><p>Source: chapter II, messages 35–48.</p><div class="actions">'+PT.button('Keep','demo')+PT.button('Edit','demo')+PT.button('Skip','demo')+'</div>'],
  'ingest-novel':['A prose edition','<p>Chapter I · The letter</p><p>The storm had already swallowed the road when the unstamped letter arrived.</p><p>Review chapter prose, then save a document and send it to the Press.</p>'],
  'ingest-manga':['Storyboard study','<p>Panel 1: the lighthouse above a storm-dark sea.</p><p>Panel 2: Vera unfolds the letter.</p><p>Image generation requires a connected image add-on. This preview does not generate anything.</p>'],
  'chapter-break':['Mark a chapter break',PT.field('Chapter title','The second ledger')+'<p>Start a new chapter from the current message. Existing messages stay in their take.</p>'],
  finding:['Follow the finding','<p>Open the exact source field or reply. Show the observation and its evidence. Drafted fixes use the existing change-review flow.</p>'],
  tokens:['Tokens & sources','<p>Character ~1,240 · persona ~180 · preset ~2,100 · lore ~1,020 · history ~1,700</p><p>Estimates and reported counts retain their labels.</p>'],
  'growth-compare':['Review proposed growth','<p><strong>Before:</strong> Vera keeps her doubts to herself.</p><p><strong>Proposed:</strong> Vera shares her doubts with Rieta, after the events of chapter III.</p><p>Source: messages 79, 98 and 142. Applying creates a new card version; other takes remain independent.</p>'],
  'theme-parts':['Named parts & layout','<p>Stage, scene.header, scene.composer, library.card, editor.field and named addition slots.</p><p>The mod manager previews affected parts and requested powers before enabling a mod.</p>'],
  'mod-manager':['Manage visual mods','<p>Paper theater · active house theme</p><p>Jewelbox JRPG · disabled</p><p>Preview · disable · export · review updates</p>'],
  'safe-mode':['Safe mode','<p>All visual mods disabled. The trusted house interface remains available to repair or remove a broken mod.</p>'],
  recovery:['Recovery options','<p>Use recovery words · unlock from a remembered computer · return to password</p><p>No actual secrets are collected by this wireframe.</p>'],
  'preset-settings':['Preset settings','<p>Sampler settings · category controls · regex links · quick-reply links · per-platform fields.</p>'],
  assets:['Art & assets','<p>Portrait crop · named assets · expressions · sprite pack · replace or remove art.</p>'],
  updates:['Version timeline','<p>Installed version · release history · changes per version · compatible rollback.</p>'],
  onboarding:['Your tiny opening act','<p>Vera: “That little hare tells you what I remembered. The meter shows how much of our story fits.”</p><p>Scripted example, no model call.</p>'+PT.link('Explore the sample scene','scene')],
  render:['A preview of the strings','<p>Inspect the rendered prompt, source blocks or sealed drawing through the existing tool surface.</p>'],
};
document.addEventListener('click',e=>{
  const button = e.target.closest('[data-action]'); if(!button)return;
  const action = button.dataset.action;
  if(action==='ready'){statePick.value='ready';render();return;}
  if(action==='unlock'){location.hash='home';return;}
  if(action==='choice'){
    document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    document.querySelector('.composer textarea').value = button.textContent.trim(); return;
  }
  if(action==='own-choice'||action==='clear-choice'){
    document.querySelectorAll('.choice').forEach(b=>b.setAttribute('aria-pressed','false'));
    const field=document.querySelector('.composer textarea');field.value='';field.focus();return;
  }
  if(action==='health-tab'){
    button.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('chosen',b===button));
    showFeedback('Sample filter selected. Live finding filters belong to TrackHare.');return;
  }
  if(action==='toggle'){button.classList.toggle('primary');button.setAttribute('aria-pressed',String(button.classList.contains('primary')));return;}
  if(previews[action]){showDialog(...previews[action]);return;}
  const messages = {save:'Preview save acknowledged. No file was changed.',send:'Preview only: no message sent and no model request made.',print:'Preview receipt: Vera + Keeper’s Log would travel as a bundle.',restore:'Preview restore acknowledged. Real Trash is untouched.',apply:'Sample change reviewed. Nothing applied to your Library.',copy:'Copy placement preview. Clipboard untouched.',replay:'Sample comparison: 160 fewer tokens, original seed retained.',reroll:'Sample reroll: a deliberate new seed, separate from replay.',discard:'Sample proposal skipped.', 'health-check':'Sample findings shown. No library scan was run.'};
  showFeedback(messages[action] || 'Design control preview. No app state changed.');
});
render();
