export function createUI({ onAction }) {
  const ids = ['app','title-menu','hud','play-footer','level-label','objective','progress-label','progress-bar','timer','score','carrying','prompt','toast','cinematic','cinematic-shade','cinematic-title','cinematic-subtitle','cinematic-lines','boot-progress','result','result-title','result-detail','result-score','result-status','pause','loading','fatal-error','fatal-message','room-label','start-button','restart-button','resume-button','reticle','torch-status','mute-button','volume','sound-controls','look-hint'];
  const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const handlers = [];
  for (const [id, action] of [['start-button','start'],['restart-button','restart'],['resume-button','resume'],['mute-button','mute']]) {
    const fn = () => onAction(action); nodes[id].addEventListener('click', fn); handlers.push([nodes[id],'click',fn]);
  }
  const volume = event => onAction('volume', Number(event.target.value) / 100);
  nodes.volume.addEventListener('input', volume); handlers.push([nodes.volume,'input',volume]);
  let lastPhase = '', lastPause = false;
  const setText = (id, value) => { if (nodes[id].textContent !== value) nodes[id].textContent = value; };
  function update(state) {
    const active = ['LEVEL_1','LEVEL_2'].includes(state.phase);
    const result = ['WIN','LOSE'].includes(state.phase);
    const corrupted = state.world.level === 2 || state.phase === 'LEVEL_TRANSITION';
    const paused = state.paused && state.phase !== 'TITLE' && !result;
    nodes.app.classList.toggle('corrupted', corrupted);
    nodes.app.classList.toggle('playing', active);
    nodes.app.classList.toggle('captured', state.phase === 'CAPTURE' && state.phaseElapsed >= 5.04);
    nodes.app.style.setProperty('--capture-red', String(state.phase === 'CAPTURE' ? Math.max(0, Math.min(.85, (state.phaseElapsed - 5.04) / 1.16)) : 0));
    nodes.app.classList.toggle('is-paused', paused);
    nodes['title-menu'].hidden = state.phase !== 'TITLE';
    nodes.hud.hidden = !active;
    nodes['play-footer'].hidden = !active;
    nodes.reticle.hidden = !active || paused || state.reading;
    const journal = document.getElementById('journal-page');
    journal.hidden = !state.reading;
    if (state.reading) document.getElementById('journal-text').textContent = 'A note tucked inside your child’s storybook:\n\nHe has been hiding things behind the bookcase again. The book with the ' + ['MOON','STAR','SUN'][state.world.secret?.targetIndex ?? 0] + ' on its spine is the one he always pulls.\n\nShelve the scattered books first. Then pull that spine toward you. Please close the room behind you.\n\nCONTROL SHUTDOWN ORDER: ' + (state.world.controlOrder ?? []).map(id => id.replace('switch-', '')).join(' → ') + '\nUse this order exactly. Control 03 is inside the archive.\n\nE or Enter — close book';
    nodes.reticle.classList.toggle('has-target', Boolean(state.target));
    nodes.result.hidden = !result; nodes.pause.hidden = !paused;
    nodes.cinematic.hidden = !state.cinematic; nodes.loading.hidden = true;
    nodes['sound-controls'].hidden = active && !paused;
    setText('room-label', corrupted ? 'HELPER_01 · RETURN TO STORAGE' : 'AFTER HOURS');
    setText('mute-button', state.muted ? 'SOUND OFF · M' : 'SOUND ON · M');
    nodes['mute-button'].setAttribute('aria-pressed', String(state.muted));
    if (active) {
      setText('level-label', state.display.level); setText('objective', state.display.objective);
      setText('progress-label', state.display.progress);
      nodes['progress-bar'].style.width = ((state.world.level === 1 ? (state.world.completedTasks ?? 0) / 2 : state.world.switchCount) / 3 * 100) + '%';
      setText('timer', state.display.timer); nodes.timer.parentElement.classList.toggle('urgent', state.timeLeft <= 20);
      setText('score', state.display.score); setText('carrying', state.display.carrying);
      setText('torch-status', state.world.player.hiddenIn ? 'HIDDEN · TORCH COVERED' : state.torchOn ? 'F · TORCH ON' : 'F · TORCH OFF');
      nodes['torch-status'].classList.toggle('off', !state.torchOn);
      setText('look-hint', state.pointerLocked ? 'WASD move · Shift sneak · Space peek while hidden · E interact · Esc pause' : 'Click room for mouse look · or drag / ← → · Q / Z look up / down');
    }
    nodes.prompt.hidden = !active || !state.target || paused;
    if (active && state.target) {
      const prompt = state.target.prompt.replace(/^E\s*[—–-]?\s*/i, '');
      if (nodes.prompt.dataset.prompt !== prompt) {
        nodes.prompt.replaceChildren(Object.assign(document.createElement('kbd'), { textContent: 'E' }), document.createTextNode(prompt));
        nodes.prompt.dataset.prompt = prompt;
      }
    }
    nodes.toast.hidden = !state.message || !active || paused;
    if (state.message) { setText('toast', state.message.text); nodes.toast.dataset.tone = state.message.tone; }
    if (state.cinematic) {
      const shot = state.cinematic;
      nodes.cinematic.dataset.kind = shot.kind;
      nodes['cinematic-shade'].style.opacity = String(shot.overlayOpacity);
      setText('cinematic-title', shot.title); setText('cinematic-subtitle', shot.subtitle);
      setText('cinematic-lines', shot.lines.join('\n'));
      nodes['boot-progress'].style.width = shot.progress * 100 + '%';
    }
    if (result) {
      setText('result-title', state.display.resultTitle); setText('result-detail', state.display.resultDetail);
      setText('result-score', state.score.toLocaleString('en-US'));
      setText('result-status', state.phase === 'WIN' ? 'STATUS: UNACCOUNTED FOR' : 'STATUS: INVENTORY RESTORED');
    }
    if (lastPhase !== state.phase) {
      if (state.phase === 'TITLE') nodes['start-button'].focus({ preventScroll: true });
      if (result) nodes['restart-button'].focus({ preventScroll: true });
      lastPhase = state.phase;
    }
    if (paused && !lastPause) nodes['resume-button'].focus({ preventScroll: true });
    lastPause = paused;
  }
  return { update, showError(message) { nodes.loading.hidden = true; nodes['fatal-error'].hidden = false; setText('fatal-message', message); nodes['fatal-error'].querySelector('button')?.focus({ preventScroll: true }); }, dispose() { handlers.forEach(([node,type,fn]) => node.removeEventListener(type,fn)); } };
}
