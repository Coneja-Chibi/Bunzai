/** Clickable foyer concept: sample destinations, story setup, and appearance controls only. */
const dialog = document.getElementById('destination');
const heading = document.getElementById('destination-title');
const body = document.getElementById('destination-body');
const list = entries => `<div class="preview-list">${entries.map(([name, detail, target]) => `<a class="preview-item" href="#${target}"><strong>${name}</strong><small>${detail}</small></a>`).join('')}</div>`;
const views = {
  apps: ['Apps', '<p>The existing Dock opens the packaged app catalog here.</p>' + list([['Help / Docs','Find your way around Bunzai','help'],['The Library','Browse your cast and worlds','library']])],
  agent: ['The Agent', '<p>The existing agent workspace opens here. This wireframe does not contact a model.</p>'],
  scenes: ['Your stories', '<p>Pick up a saved story or begin a new one.</p>' + list([['The Paper Moon','Act II · Scene 07 · 3 cast members','resume'],['The Orchard After Dark','Act I · Scene 03 · 2 cast members','resume'],['A House Without Doors','Opening scene · 1 cast member','resume']]) + '<p><a class="button primary" href="#new-story">New story</a></p>'],
  resume: ['The Paper Moon', '<span class="eyebrow gilt">Act II · The last letter</span><p>The post office has been closed for thirty years. Tonight, a light burns behind its door.</p><p>This is where the selected scene workspace would open, with its cast, conversation and branches.</p>' + list([['Choose another story','Return to your saved scenes','scenes'],['Review the cast','Characters attached to this scene','cast']])],
  library: ['The Library', '<p>Your pieces, ready for the next production.</p>' + list([['Characters & personas','Meet your cast and choose who you play','cast'],['Lorebooks & knowledge','The details that make a world feel lived in','worlds'],['Presets & prompts','Prepare the voice and behavior of a scene','workbench'],['Import a piece','Bring an existing card or lorebook into your library','import']])],
  cast: ['Meet your cast', '<p>Sample library shelf.</p>' + list([['Mira, the letter carrier','Character · The Paper Moon','workbench'],['The clockmaker','Character · The Paper Moon','workbench'],['The traveler','Persona · Your role in the scene','workbench']])],
  worlds: ['Build the world', '<p>Sample lorebook shelf.</p>' + list([['The city of borrowed names','Lorebook · Places, customs and hidden history','workbench'],['The lunar archive','Lorebook · What the moon remembers','workbench']])],
  workbench: ['The Workbench', '<p>A compact preview of editing a selected piece.</p><form class="form"><label>Name<input value="Mira, the letter carrier"></label><label>Description<textarea>A quiet courier who delivers letters nobody remembers writing.</textarea></label><label>First message<textarea>The envelope is warm. Your name is written on it in your own handwriting.</textarea></label><button class="button primary" type="submit">Save preview</button><p class="feedback" role="status"></p></form>'],
  press: ['The Press', '<p>Staged pieces travel together. Choose a target format before exporting.</p><div class="preview-item"><strong>Mira, the letter carrier</strong><small>Character + linked lorebook</small></div><form class="form"><label>Target format<select><option>Character Card v3</option><option>Character Card v2</option><option>RoleCall</option></select></label><button class="button primary" type="submit">Preview export</button><p class="feedback" role="status"></p></form>'],
  import: ['Bring something in', '<p>Import belongs to your library. Cards, lorebooks, personas, presets and bundles can be brought in here.</p><form class="form"><label>Choose an existing piece<input type="file" accept=".json,.png,.charx,.zip"></label><button class="button primary" type="submit">Preview import</button><p class="feedback" role="status"></p></form>'],
  'new-story': ['Raise a new curtain', '<p>Give your next story a name, then gather a cast.</p><form class="form"><label>Story title<input placeholder="An untitled production" required></label><label>Opening idea<textarea placeholder="Where does the first scene begin?"></textarea></label><label>Choose a cast<select><option>Mira, the letter carrier</option>The clockmaker</option>Choose later</option></select></label><button class="button primary" type="submit">Set the scene</button><p class="feedback" role="status"></p></form>'],
  help: ['A look backstage', '<details open><summary>Where do I begin?</summary><p>Start a story, choose a character from your Library, or import something you already have.</p></details><details><summary>What is the Workbench for?</summary><p>Edit the fields, prompts and supporting pieces that shape a character or world.</p></details><details><summary>How do I take a piece elsewhere?</summary><p>Stage it for the Press, choose the destination format, then inspect the export.</p></details>'],
  settings: ['Set the atmosphere', '<form class="form"><label class="check"><input type="checkbox" name="atmosphere" checked>Animated lights and fog</label><label class="check"><input type="checkbox" checked>Spotlights follow the mouse</label><p>Appearance controls shown here are a design proposal. Only the atmosphere toggle is wired in this prototype.</p></form>'],
};
function navigate() {
  const key = location.hash.slice(1);
  if (!key || key === 'home') { if (dialog.open) dialog.close(); return; }
  const view = views[key];
  if (!view) return;
  heading.textContent = view[0]; body.innerHTML = view[1];
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
window.addEventListener('hashchange', navigate);
dialog.querySelector('.close').addEventListener('click', () => { location.hash = 'home'; });
dialog.addEventListener('cancel', () => { location.hash = 'home'; });
dialog.addEventListener('close', () => { if (location.hash !== '#home') location.hash = 'home'; });
body.addEventListener('submit', event => {
  event.preventDefault();
  event.target.querySelector('.feedback').textContent = 'Preview updated. Sample content only; nothing is saved or exported.';
});
body.addEventListener('change', event => {
  if (event.target.name === 'atmosphere') window.setStageAtmosphere?.(event.target.checked);
});
navigate();
