/**
 * @file mvp-incendio.js
 * @description Interactive branching-video experience "MVP Incendio".
 *
 * Architecture — SOLID principles applied:
 *
 *  S — Single Responsibility
 *        Each module has one clear purpose:
 *        StoryData   → holds the narrative tree (pure data, no logic).
 *        YouTubePlayer → owns all interaction with the YT IFrame API.
 *        ChoiceUI    → renders decision buttons and the countdown bar.
 *        OverlayUI   → renders death / victory result screens.
 *        GameEngine  → orchestrates the flow between the modules above.
 *        TitleMenu   → manages the title screen nav modals (NEW).
 *
 *  O — Open / Closed
 *        New scene types (e.g. "minigame", "timed") can be added to
 *        StoryData and handled in GameEngine.handleSceneEnd() without
 *        touching any other module.
 *
 *  L — Liskov Substitution
 *        Every scene-type handler in GameEngine follows the same
 *        contract: receive a node object, produce a side effect.
 *        They are interchangeable from the engine's perspective.
 *
 *  I — Interface Segregation
 *        Each module exposes only the methods its consumers need.
 *        YouTubePlayer does not know about UI; ChoiceUI does not know
 *        about YouTube; OverlayUI does not know about game state.
 *
 *  D — Dependency Inversion
 *        GameEngine depends on the abstract interfaces of each module,
 *        not on their internal implementation details. Callbacks are
 *        injected at construction time.
 */

'use strict';

/* =============================================================================
   MODULE: StoryData
   ============================================================================= */

/** @enum {string} Video IDs indexed by logical name. */
const VIDEO_IDS = Object.freeze({
  MVP1: 'JkpT1p6kx_A',
  MVP2: 'lyiyeg1a_q8',
  MVP3: 'f_ws5om-Qt8',
  MVP4: '_5jOYoXuJ8Q',
  MVP5: 'hxkzjoSS9R8',
  MVP6: 'khcUzFZEuGw',
  MVP7: 'fzoq9A1XoEM',
  MVP8: 'OGY6pNy7Qd8',
  MVP9: '3dBtkS7063c',
});

/** @type {Object.<string, StoryNode>} */
const STORY_GRAPH = Object.freeze({

  intro: {
    video: VIDEO_IDS.MVP1,
    type: 'choices',
    choices: [
      { label: 'Subir al ascensor',            sub: 'Puede ser más rápido para bajar',  next: 'ascensor'  },
      { label: 'Usar las escaleras',            sub: 'Más seguro, pero hay humo',        next: 'escaleras' },
    ],
  },

  ascensor: {
    video: VIDEO_IDS.MVP2,
    type: 'death',
    title: 'MORISTE',
    desc: 'Te asfixiaste atrapado en el ascensor. El humo no perdona.',
    btns: [{ label: '↺ Reintentar', next: 'intro', style: '' }],
  },

  escaleras: {
    video: VIDEO_IDS.MVP3,
    type: 'choices',
    choices: [
      { label: 'Saltar el fuego',               sub: 'Las llamas parecen cruzables...',       next: 'saltar_fuego' },
      { label: 'Usar el extintor',              sub: 'El extintor está en el corredor',       next: 'ruta_b1'      },
      { label: 'Usar la manguera del gabinete', sub: 'Controlar el fuego antes de avanzar',   next: 'manguera'     },
    ],
  },

  saltar_fuego: {
    video: VIDEO_IDS.MVP8,
    type: 'death',
    title: 'MORISTE',
    desc: 'Las llamas te alcanzaron. El fuego no se puede cruzar.',
    btns: [{ label: '↺ Reintentar desde aquí', next: 'escaleras', style: '' }],
  },

  ruta_b1: { video: VIDEO_IDS.MVP5, type: 'autoNext', next: 'ruta_b2' },
  ruta_b2: { video: VIDEO_IDS.MVP9, type: 'autoNext', next: 'ruta_b3' },
  ruta_b3: {
    video: VIDEO_IDS.MVP6,
    type: 'choices',
    choices: [
      { label: 'Salida de emergencia', sub: 'La señal verde parpadea al fondo', next: 'win_salida' },
      { label: 'Salida principal',     sub: 'Por donde entraste al edificio',   next: 'win_salida' },
    ],
  },

  manguera: {
    video: VIDEO_IDS.MVP4,
    type: 'choices',
    choices: [
      { label: 'Salida de emergencia', sub: 'El corredor lateral parece despejado', next: 'salida_emerg_manguera' },
      { label: 'Salida principal',     sub: 'Por donde entraste al edificio',       next: 'win_salida'            },
    ],
  },

  salida_emerg_manguera: {
    video: VIDEO_IDS.MVP7,
    type: 'death',
    title: 'FLASHOVER',
    desc: 'La temperatura alcanzó el punto de ignición. Todo ardió en un instante.',
    btns: [
      { label: '↺ Reintentar',     next: 'manguera',   style: ''        },
      { label: 'Salida principal', next: 'win_salida', style: 'primary' },
    ],
  },

  win_salida: {
    type: 'win',
    title: '¡SALISTE!',
    desc: 'Lograste escapar del incendio. Tus decisiones te salvaron la vida.',
    btns: [{ label: '↺ Jugar de nuevo', next: 'intro', style: 'primary' }],
  },
});

/* =============================================================================
   MODULE: YouTubePlayer
   ============================================================================= */
class YouTubePlayer {
  constructor(containerId, onEnded) {
    this._player         = null;
    this._ready          = false;
    this._pendingVideoId = null;
    this._onEnded        = onEnded;
    this._containerId    = containerId;
  }

  init() {
    this._player = new YT.Player(this._containerId, {
      width: '100%',
      height: '100%',
      videoId: '',
      playerVars: {
        autoplay:       1,
        controls:       0,
        rel:            0,
        showinfo:       0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs:             0,
        disablekb:      1,
        playsinline:    1,
        enablejsapi:    1,
      },
      events: {
        onReady:       () => this._handleReady(),
        onStateChange: (e) => this._handleStateChange(e),
      },
    });
  }

  load(videoId) {
    if (!this._ready) { this._pendingVideoId = videoId; return; }
    this._player.loadVideoById({ videoId, startSeconds: 0 });
  }

  stop() {
    if (this._ready && this._player) this._player.stopVideo();
  }

  /** Pauses the currently playing video. */
  pauseVideo() {
    if (this._ready && this._player) this._player.pauseVideo();
  }

  /** Resumes a paused video. */
  resume() {
    if (this._ready && this._player) this._player.playVideo();
  }

  /**
   * Sets the player volume.
   * @param {number} vol - 0 to 100.
   */
  setVolume(vol) {
    if (this._ready && this._player) this._player.setVolume(vol);
  }

  _handleReady() {
    this._ready = true;
    if (this._pendingVideoId) {
      this._player.loadVideoById({ videoId: this._pendingVideoId, startSeconds: 0 });
      this._pendingVideoId = null;
    }
  }

  _handleStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) this._onEnded();
  }
}

/* =============================================================================
   MODULE: ChoiceUI
   ============================================================================= */
class ChoiceUI {
  constructor({ panel, row, fill }, onChoose, autoSelectMs = 15000) {
    this._panel        = panel;
    this._row          = row;
    this._fill         = fill;
    this._onChoose     = onChoose;
    this._autoSelectMs = autoSelectMs;
    this._timer        = null;
  }

  show(node) {
    this._row.innerHTML = node.choices
      .map((c) => `<button class="choice-btn" data-next="${c.next}">
        ${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}
      </button>`)
      .join('');

    this._row.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._onChoose(btn.dataset.next));
    });

    this._panel.classList.add('show');
    this._startCountdown(node);
  }

  hide() {
    this._panel.classList.remove('show');
    this._stopCountdown();
  }

  handleKeyPress(key, node) {
    const index = ['1', '2', '3'].indexOf(key);
    if (index !== -1 && node.choices[index]) this._onChoose(node.choices[index].next);
  }

  _startCountdown(node) {
    this._fill.className = '';
    void this._fill.offsetHeight;
    this._fill.className = 'running';
    this._stopCountdown();
    this._timer = setTimeout(() => {
      const random = node.choices[Math.floor(Math.random() * node.choices.length)];
      this._onChoose(random.next);
    }, this._autoSelectMs);
  }

  _stopCountdown() {
    clearTimeout(this._timer);
    this._timer = null;
    this._fill.className = '';
  }
}

/* =============================================================================
   MODULE: OverlayUI
   ============================================================================= */
class OverlayUI {
  constructor(container, onAction) {
    this._container = container;
    this._onAction  = onAction;
  }

  show(node) {
    const isWin = node.type === 'win';
    this._container.querySelector('#overlay-tag').textContent   = isWin ? 'Resultado final' : '— Fin —';
    this._container.querySelector('#overlay-title').textContent = node.title;
    this._container.querySelector('#overlay-title').className   = `overlay-title ${isWin ? 'win' : 'death'}`;
    this._container.querySelector('#overlay-desc').textContent  = node.desc;

    const btnsEl = this._container.querySelector('#overlay-btns');
    btnsEl.innerHTML = node.btns
      .map((b) => `<button class="overlay-btn ${b.style || ''}" data-next="${b.next}">${b.label}</button>`)
      .join('');

    btnsEl.querySelectorAll('.overlay-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._onAction(btn.dataset.next));
    });

    this._container.style.display = 'flex';
  }

  hide() {
    this._container.style.display = 'none';
  }
}

/* =============================================================================
   MODULE: TitleMenu  (NEW)
   Responsibility: Wire "Cómo jugar" and "Créditos" modals on the title screen.
   ============================================================================= */

/**
 * @class TitleMenu
 * Manages the title screen secondary navigation (modal windows).
 * Completely decoupled from the game engine.
 */
class TitleMenu {
  constructor() {
    this._modals = {
      how:     document.getElementById('modal-how'),
      credits: document.getElementById('modal-credits'),
    };
    this._bindEvents();
  }

  /** Wire all button clicks and backdrop / close-button dismissals. */
  _bindEvents() {
    // Open buttons
    document.getElementById('how-btn').addEventListener('click', () => this.openModal('how'));
    document.getElementById('credits-btn').addEventListener('click', () => this.openModal('credits'));

    // Close via ✕ button or backdrop (both share data-close attribute)
    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.close.replace('modal-', '');
        this.closeModal(key);
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeAll();
    });
  }

  /** @param {'how'|'credits'} key */
  openModal(key) {
    const modal = this._modals[key];
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  /** @param {'how'|'credits'} key */
  closeModal(key) {
    const modal = this._modals[key];
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  _closeAll() {
    Object.keys(this._modals).forEach((k) => this.closeModal(k));
  }
}

/* =============================================================================
   MODULE: PauseMenu  (NEW)
   Responsibility: Handle pause/resume gameplay, volume, and menu navigation.
   Depends on: YouTubePlayer (to pause/resume/setVolume), TitleMenu (for
   "Cómo jugar" modal), GameEngine (to call navigateTo on "back to menu").
   ============================================================================= */

/**
 * @class PauseMenu
 * Controls the in-game pause overlay and its actions.
 * Injected with callbacks so it stays decoupled from concrete implementations.
 *
 * @param {Object}   opts
 * @param {Function} opts.onPause       - Callback: pause video playback.
 * @param {Function} opts.onResume      - Callback: resume the game.
 * @param {Function} opts.onHowToPlay   - Callback: open the "Cómo jugar" modal.
 * @param {Function} opts.onMainMenu    - Callback: return to the title screen.
 * @param {Function} opts.onVolumeChange- Callback invoked with new volume (0–100).
 */
class PauseMenu {
  constructor({ onPause, onResume, onHowToPlay, onMainMenu, onVolumeChange }) {
    this._onPause        = onPause;
    this._onResume       = onResume;
    this._onHowToPlay    = onHowToPlay;
    this._onMainMenu     = onMainMenu;
    this._onVolumeChange = onVolumeChange;

    /** @private @type {boolean} */
    this._paused = false;

    /** @private DOM refs */
    this._pauseBtn    = document.getElementById('pause-btn');
    this._pauseMenu   = document.getElementById('pause-menu');
    this._volSlider   = document.getElementById('volume-slider');
    this._volDisplay  = document.getElementById('vol-display');

    this._bindEvents();
    this._updateSliderFill(this._volSlider.value);
  }

  // ── Public API ────────────────────────────────────────

  /** Make the pause button visible (called when gameplay starts). */
  show() {
    this._pauseBtn.classList.add('visible');
  }

  /** Hide the pause button entirely (title screen / result overlay). */
  hide() {
    this._pauseBtn.classList.remove('visible');
    this._closePauseMenu();
  }

  /** Returns true while the game is paused. */
  get isPaused() { return this._paused; }

  // ── Private ───────────────────────────────────────────

  _bindEvents() {
    // Pause / resume toggle
    this._pauseBtn.addEventListener('click', () => this._toggle());

    // Pause menu actions
    document.getElementById('resume-btn')
      .addEventListener('click', () => this._resume());

    document.getElementById('pause-how-btn')
      .addEventListener('click', () => {
        // Keep game paused; just open the modal on top
        this._onHowToPlay();
      });

    document.getElementById('back-to-menu-btn')
      .addEventListener('click', () => {
        this._closePauseMenu();
        this.hide();
        this._onMainMenu();
      });

    // Volume slider
    this._volSlider.addEventListener('input', () => {
      const v = parseInt(this._volSlider.value, 10);
      this._volDisplay.textContent = v;
      this._updateSliderFill(v);
      this._onVolumeChange(v);
    });

    // Keyboard: Escape toggles pause when gameplay is active
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._pauseBtn.classList.contains('visible')) {
        this._toggle();
      }
    });
  }

  _toggle() {
    this._paused ? this._resume() : this._pause();
  }

  _pause() {
    this._paused = true;
    this._onPause();            // pause video playback
    this._updatePauseIcon(true);
    this._pauseMenu.classList.add('open');
    this._pauseMenu.setAttribute('aria-hidden', 'false');
  }

  _resume() {
    this._onResume();           // engine/player side
    this._closePauseMenu();
  }

  _closePauseMenu() {
    this._paused = false;
    this._updatePauseIcon(false);
    this._pauseMenu.classList.remove('open');
    this._pauseMenu.setAttribute('aria-hidden', 'true');
  }

  /** Swap the SVG icon between ❚❚ (pause) and ▶ (play). */
  _updatePauseIcon(isPaused) {
    const icon = document.getElementById('pause-icon');
    if (isPaused) {
      // Show play triangle (resume cue)
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5v14l11-7z"/>
      </svg>`;
    } else {
      // Show two-bar pause symbol
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="5"  y="3" width="4" height="18" rx="1"/>
        <rect x="15" y="3" width="4" height="18" rx="1"/>
      </svg>`;
    }
  }

  /** Paint the left (filled) portion of the range track. */
  _updateSliderFill(value) {
    const pct = value + '%';
    this._volSlider.style.backgroundSize = pct + ' 100%';
    this._volSlider.style.backgroundImage =
      'linear-gradient(to right, #ff6a00 0%, #ff8c00 100%)';
    this._volSlider.style.backgroundRepeat = 'no-repeat';
    this._volSlider.style.backgroundColor = 'rgba(255,255,255,0.1)';
  }
}

/* =============================================================================
   MODULE: GameEngine  (updated to support pause)
   ============================================================================= */
class GameEngine {
  constructor(storyGraph, player, choiceUI, overlayUI) {
    this._story       = storyGraph;
    this._player      = player;
    this._choiceUI    = choiceUI;
    this._overlayUI   = overlayUI;
    this._currentNode = null;

    /** @type {PauseMenu|null} Set via setPauseMenu() after construction. */
    this._pauseMenu   = null;
  }

  /** Late-inject the PauseMenu to break the circular dependency. */
  setPauseMenu(pauseMenu) {
    this._pauseMenu = pauseMenu;
  }

  navigateTo(nodeId) {
    const node = this._story[nodeId];
    if (!node) { console.error(`[GameEngine] Node not found: "${nodeId}"`); return; }

    this._currentNode = null;
    this._choiceUI.hide();
    this._overlayUI.hide();

    if (node.type === 'win') {
      this._player.stop();
      this._overlayUI.show(node);
      this._pauseMenu?.hide();
      return;
    }

    // Show pause button as soon as gameplay video starts
    this._pauseMenu?.show();

    this._currentNode = node;
    this._player.load(node.video);
  }

  handleVideoEnded() {
    if (!this._currentNode) return;
    const handlers = {
      choices:  (node) => this._choiceUI.show(node),
      autoNext: (node) => setTimeout(() => this.navigateTo(node.next), 200),
      death:    (node) => {
        this._overlayUI.show(node);
        this._pauseMenu?.hide();
      },
    };
    const handler = handlers[this._currentNode.type];
    if (handler) handler(this._currentNode);
    else console.warn(`[GameEngine] No handler for type: "${this._currentNode.type}"`);
  }

  handleKeyPress(key) {
    // Don't process choice shortcuts while paused
    if (this._pauseMenu?.isPaused) return;
    if (this._currentNode?.type === 'choices') this._choiceUI.handleKeyPress(key, this._currentNode);
  }
}

/* =============================================================================
   BOOTSTRAP
   ============================================================================= */
function buildApp() {
  let engineRef = null;
  const navigate = (nodeId) => engineRef.navigateTo(nodeId);

  const choiceUI = new ChoiceUI(
    {
      panel: document.getElementById('choices'),
      row:   document.getElementById('choices-row'),
      fill:  document.getElementById('countdown-fill'),
    },
    navigate,
    15_000
  );

  const overlayUI  = new OverlayUI(document.getElementById('overlay'), navigate);
  const player     = new YouTubePlayer('yt-player', () => engineRef.handleVideoEnded());
  const engine     = new GameEngine(STORY_GRAPH, player, choiceUI, overlayUI);
  engineRef = engine;

  // Title screen modals manager
  const titleMenu = new TitleMenu();

  // Pause menu — callbacks injected to keep modules decoupled
  const pauseMenu = new PauseMenu({
    onPause: () => {
      player.pauseVideo();
    },
    onResume: () => {
      player.resume();
    },
    onHowToPlay: () => {
      titleMenu.openModal('how');   // reuse the same modal
    },
    onMainMenu: () => {
      player.stop();
      engine.resetState?.();
      returnToTitleScreen();
    },
    onVolumeChange: (vol) => {
      player.setVolume(vol);
    },
  });

  engine.setPauseMenu(pauseMenu);

  // Keyboard shortcuts (choice selection, delegated to engine)
  document.addEventListener('keydown', (e) => engine.handleKeyPress(e.key));

  return { engine, player, titleMenu };
}

/** Resets the UI back to the title screen without reloading the page. */
function returnToTitleScreen() {
  const ts = document.getElementById('title-screen');
  ts.classList.remove('hide');
  ts.style.opacity = '';
  ts.style.pointerEvents = '';
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('choices').classList.remove('show');
}

const { engine, player, titleMenu } = buildApp();

/* =============================================================================
   GLOBAL HOOKS
   ============================================================================= */

function onYouTubeIframeAPIReady() { // eslint-disable-line no-unused-vars
  player.init();
}

function startStory() { // eslint-disable-line no-unused-vars
  document.getElementById('title-screen').classList.add('hide');
  setTimeout(() => engine.navigateTo('intro'), 600);
}

document.getElementById('start-btn').addEventListener('click', startStory);