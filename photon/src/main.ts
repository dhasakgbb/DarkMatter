// Bootstrap. Order matters: scene before audio before track before photon before gameplay systems.
import './scene';
import './audio';
import './track';
import './particles';
import './echoes';
import './photon';
import './hazards';
import './racing';
import { applySettings } from './settings';
import { bindUI, refreshTitleStats } from './ui';
import { bindInput } from './input';
import { setState, startLoop } from './game';

bindUI();
bindInput();
applySettings();
refreshTitleStats();
setState('title');

setTimeout(() => {
  const boot = document.getElementById('boot');
  if (boot) boot.classList.add('gone');
}, 600);

startLoop();
