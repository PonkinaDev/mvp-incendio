/**
 * @file mvp-incendio.js
 * @description Interactive branching-video experience "MVP Incendio".
 *              Videos are served locally from the /Videos/ folder.
 *
 * Architecture — SOLID principles applied:
 *
 *  S — Single Responsibility
 *        StoryData   → holds the narrative tree (pure data, no logic).
 *        VideoPlayer → owns all interaction with the HTML5 <video> element.
 *        ChoiceUI    → renders decision buttons and the countdown bar.
 *        OverlayUI   → renders death / victory result screens.
 *        GameEngine  → orchestrates the flow between the modules above.
 *        TitleMenu   → manages the title screen nav modals.
 *
 *  O — Open / Closed
 *        New scene types can be added to StoryData and handled in
 *        GameEngine.handleSceneEnd() without touching any other module.
 *
 *  L — Liskov Substitution
 *        Every scene-type handler in GameEngine follows the same contract.
 *
 *  I — Interface Segregation
 *        Each module exposes only the methods its consumers need.
 *
 *  D — Dependency Inversion
 *        GameEngine depends on abstract interfaces; callbacks injected at
 *        construction time.
 */

'use strict';

/* =============================================================================
   MODULE: StoryData
   ============================================================================= */

/**
 * Base path for all video files.
 * Videos must be in a folder called "Videos" at the same level as this script.
 * @constant {string}
 */
const VIDEO_BASE = 'Videos/';

/** @enum {string} Video file paths indexed by logical name. */
const VIDEO_PATHS = Object.freeze({
  MARCOS_01: VIDEO_BASE + 'VideoMarcos01.mp4',
  MARCOS_02: VIDEO_BASE + 'VideoMarcos02.mp4',
  MARCOS_03: VIDEO_BASE + 'VideoMarcos03.mp4',
  MARCOS_04: VIDEO_BASE + 'VideoMarcos04.mp4',
  MARCOS_05: VIDEO_BASE + 'VideoMarcos05.mp4',
  MARCOS_06: VIDEO_BASE + 'VideoMarcos06.mp4',
  MARCOS_07: VIDEO_BASE + 'VideoMarcos07.mp4',
});

/**
 * Story graph describing the branching narrative.
 *
 * Node types:
 *   'choices'  – video ends → show choice buttons
 *   'autoNext' – video ends → auto-advance to next node (no user input)
 *   'death'    – video ends → show death overlay
 *   'win'      – no video   → show win/continue overlay immediately
 *
 * @type {Object.<string, StoryNode>}
 */
const STORY_GRAPH = Object.freeze({

  // ── INICIO ────────────────────────────────────────────────────────────────
  intro: {
    video: VIDEO_PATHS.MARCOS_01,
    type: 'choices',
    choices: [
      {
        label: 'Abrir directamente',
        sub:   'Parece la salida más rápida',
        next:  'abrir_directo',
      },
      {
        label: 'Tocar primero con el dorso de la mano',
        sub:   'Comprobar si la puerta está caliente antes de abrirla',
        next:  'tocar_dorso',
      },
    ],
  },

  // ── RAMA A: Abrir directamente → muerte Flashover ─────────────────────────
  abrir_directo: {
    video: VIDEO_PATHS.MARCOS_02,
    type:  'death',
    title: 'HAS MUERTO',
    subtitle: 'Flashover',
    desc: 'El flashover es el punto de ignición simultánea de todos los '
        + 'materiales combustibles de una habitación. Al abrir la puerta sin '
        + 'verificar, permitiste la entrada de oxígeno que desencadenó una '
        + 'explosión de calor instantánea. No hay tiempo de reacción posible.',
    btns: [
      { label: '↺ Reintentar', next: 'intro', style: '' },
    ],
  },

  // ── RAMA B: Tocar dorso → pasillo ─────────────────────────────────────────
  tocar_dorso: {
    video: VIDEO_PATHS.MARCOS_03,
    type:  'autoNext',
    next:  'pasillo',
  },

  pasillo: {
    video: VIDEO_PATHS.MARCOS_04,
    type:  'choices',
    choices: [
      {
        label: 'Correr',
        sub:   'Llegar a la salida lo más rápido posible',
        next:  'correr',
      },
      {
        label: 'Agacharse e ir rápido',
        sub:   'El humo sube, pero el trayecto es largo',
        next:  'agacharse',
      },
      {
        label: 'Agacharse y cubrirse nariz y boca con un pañuelo',
        sub:   'Protegerse del humo antes de avanzar',
        next:  'panuelo',
      },
    ],
  },

  // ── Opción 1 del pasillo: Correr → muerte asfixia ─────────────────────────
  correr: {
    video: VIDEO_PATHS.MARCOS_05,
    type:  'death',
    title: 'HAS MUERTO',
    subtitle: 'Asfixia por intoxicación',
    desc: 'Al correr erguido inhalaste grandes cantidades de gases tóxicos '
        + '(monóxido de carbono, cianuro de hidrógeno) presentes en el humo. '
        + 'Estos gases causan pérdida de consciencia en segundos y son letales '
        + 'antes de que el fuego te alcance físicamente.',
    btns: [
      { label: '↺ Reintentar', next: 'pasillo', style: '' },
    ],
  },

  // ── Opción 2 del pasillo: Agacharse solo → muerte asfixia ─────────────────
  agacharse: {
    video: VIDEO_PATHS.MARCOS_06,
    type:  'death',
    title: 'HAS MUERTO',
    subtitle: 'Intoxicación por asfixia',
    desc: 'Agacharse reduce la exposición al humo en trayectos cortos, pero '
        + 'no es suficiente en pasillos largos. Sin protección en nariz y boca, '
        + 'seguiste inhalando gases tóxicos durante todo el recorrido. '
        + 'La combinación de calor y toxinas te superó antes de llegar a la salida.',
    btns: [
      { label: '↺ Reintentar', next: 'pasillo', style: '' },
    ],
  },

  // ── Opción 3 del pasillo: Pañuelo → continuará ────────────────────────────
  panuelo: {
    video: VIDEO_PATHS.MARCOS_07,
    type:  'win',
    // 'win' nodes show the overlay immediately after the video ends.
    // The overlay is shown from handleVideoEnded via the 'win_pending' mechanism.
    // See GameEngine.handleVideoEnded() below.
  },

  // ── Pantalla final: Continuará ────────────────────────────────────────────
  continuara: {
    type:  'win',
    title: 'CONTINUARÁ…',
    desc:  'Tomaste la decisión correcta. Cubrirte nariz y boca y mantenerte '
         + 'agachado durante todo el trayecto filtró parte de los gases y te '
         + 'mantuvo en la capa de aire más limpia. Tu historia continúa.',
    btns: [
      { label: '↺ Jugar de nuevo', next: 'intro', style: 'primary' },
    ],
  },

});

/* =============================================================================
   MODULE: VideoPlayer
   Wraps the native HTML5 <video> element with the same public API that
   GameEngine expects (originally fulfilled by YouTubePlayer).
   ============================================================================= */

/**
 * @class VideoPlayer
 * Owns all interaction with the HTML5 <video> element.
 *
 * Public API:
 *   init()            – connect to the DOM element (call once on startup)
 *   load(src)         – load and play a new video file
 *   stop()            – pause, rewind, and clear src (use for back-to-menu)
 *   pauseAtEnd()      – pause on the last frame WITHOUT clearing src
 *                       (use before showing overlays/choices)
 *   pauseVideo()      – pause playback
 *   resume()          – resume playback
 *   setVolume(0-100)  – set volume (converts to 0-1 range for HTML5)
 */
class VideoPlayer {
  /**
   * @param {string}   elementId - ID of the <video> element in the DOM.
   * @param {Function} onEnded   - Callback fired when the current video ends.
   */
  constructor(elementId, onEnded) {
    this._elementId = elementId;
    this._onEnded   = onEnded;
    this._video     = null;
  }

  /** Connect to the <video> element and attach the 'ended' listener. */
  init() {
    this._video = document.getElementById(this._elementId);
    if (!this._video) {
      console.error(`[VideoPlayer] Element #${this._elementId} not found.`);
      return;
    }
    this._video.addEventListener('ended', () => this._onEnded());
    this._video.muted  = false;
    this._video.volume = 0.8; // 80% default — matches slider default
  }

  /**
   * Load a new video source and start playing immediately.
   * @param {string} src - Relative or absolute path to the video file.
   */
  load(src) {
    if (!this._video) return;
    this._video.src = src;
    this._video.load();
    this._video.play().catch((err) => {
      console.warn('[VideoPlayer] Autoplay blocked:', err);
    });
  }

  /**
   * FIX: Pause on the very last frame, keeping the src intact.
   * Use this when showing overlays or choice panels so the background
   * remains the final video frame instead of going black.
   */
  pauseAtEnd() {
    if (!this._video) return;
    this._video.pause();
    // Seek back one frame (≈33 ms) to ensure the last frame is visible.
    // Some browsers clear the frame when playback ends; this prevents that.
    if (this._video.duration && isFinite(this._video.duration)) {
      this._video.currentTime = Math.max(0, this._video.duration - 0.033);
    }
  }

  /**
   * Fully stop playback and clear the src.
   * Use ONLY when returning to the main menu, to free resources.
   */
  stop() {
    if (!this._video) return;
    this._video.pause();
    this._video.currentTime = 0;
    this._video.src = '';
    this._video.load(); // flush the media pipeline
  }

  /** Pause the current video (mid-playback, e.g. pause menu). */
  pauseVideo() {
    if (!this._video) return;
    this._video.pause();
  }

  /** Resume a paused video. */
  resume() {
    if (!this._video) return;
    this._video.play().catch(() => {});
  }

  /**
   * Set the playback volume.
   * @param {number} vol - 0 to 100 (maps to HTML5 range 0.0–1.0).
   */
  setVolume(vol) {
    if (!this._video) return;
    this._video.volume = Math.max(0, Math.min(100, vol)) / 100;
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
    this._container.querySelector('#overlay-title').textContent = node.title || '';
    this._container.querySelector('#overlay-title').className   = `overlay-title ${isWin ? 'win' : 'death'}`;

    // Optional subtitle (e.g. "Flashover", "Asfixia por intoxicación")
    const subtitleEl = this._container.querySelector('#overlay-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = node.subtitle || '';
      subtitleEl.style.display = node.subtitle ? '' : 'none';
    }

    this._container.querySelector('#overlay-desc').textContent  = node.desc || '';

    const btnsEl = this._container.querySelector('#overlay-btns');
    btnsEl.innerHTML = (node.btns || [])
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
   MODULE: TitleMenu
   Manages "Cómo jugar" and "Créditos" modals on the title screen.
   ============================================================================= */
class TitleMenu {
  constructor() {
    this._modals = {
      how:     document.getElementById('modal-how'),
      credits: document.getElementById('modal-credits'),
    };
    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('how-btn').addEventListener('click', () => this.openModal('how'));
    document.getElementById('credits-btn').addEventListener('click', () => this.openModal('credits'));

    document.querySelectorAll('[data-close]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.close.replace('modal-', '');
        this.closeModal(key);
      });
    });

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
   MODULE: PauseMenu
   Handles pause/resume, volume, and navigation to main menu.
   ============================================================================= */
class PauseMenu {
  constructor({ onPause, onResume, onHowToPlay, onMainMenu, onVolumeChange }) {
    this._onPause        = onPause;
    this._onResume       = onResume;
    this._onHowToPlay    = onHowToPlay;
    this._onMainMenu     = onMainMenu;
    this._onVolumeChange = onVolumeChange;

    this._paused     = false;
    this._muted      = false;
    this._lastVolume = 80;

    this._pauseBtn   = document.getElementById('pause-btn');
    this._pauseMenu  = document.getElementById('pause-menu');
    this._volSlider  = document.getElementById('volume-slider');
    this._volDisplay = document.getElementById('vol-display');
    this._activeFill = document.getElementById('slider-active-fill');
    this._muteBtn    = document.getElementById('mute-btn');

    this._bindEvents();
    this._updateSliderFill(this._volSlider.value);
  }

  show() { this._pauseBtn.classList.add('visible'); }

  hide() {
    this._pauseBtn.classList.remove('visible');
    this._closePauseMenu();
  }

  get isPaused() { return this._paused; }

  _bindEvents() {
    this._pauseBtn.addEventListener('click', () => this._toggle());

    document.getElementById('resume-btn')
      .addEventListener('click', () => this._resume());

    document.getElementById('pause-how-btn')
      .addEventListener('click', () => this._onHowToPlay());

    document.getElementById('back-to-menu-btn')
      .addEventListener('click', () => {
        this._closePauseMenu();
        this.hide();
        this._onMainMenu();
      });

    this._volSlider.addEventListener('input', () => {
      const v = parseInt(this._volSlider.value, 10);
      this._lastVolume = v;
      this._volDisplay.textContent = v;
      this._updateSliderFill(v);
      if (this._muted && v > 0) this._setMuted(false);
      this._onVolumeChange(v);
    });

    this._muteBtn.addEventListener('click', () => {
      if (this._muted) {
        this._setMuted(false);
        const restoreVol = this._lastVolume > 0 ? this._lastVolume : 80;
        this._volSlider.value = restoreVol;
        this._volDisplay.textContent = restoreVol;
        this._updateSliderFill(restoreVol);
        this._onVolumeChange(restoreVol);
      } else {
        this._lastVolume = parseInt(this._volSlider.value, 10) || 80;
        this._setMuted(true);
        this._volSlider.value = 0;
        this._volDisplay.textContent = 0;
        this._updateSliderFill(0);
        this._onVolumeChange(0);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._pauseBtn.classList.contains('visible')) {
        this._toggle();
      }
    });
  }

  _toggle() { this._paused ? this._resume() : this._pause(); }

  _pause() {
    this._paused = true;
    this._onPause();
    this._updatePauseIcon(true);
    this._pauseMenu.classList.add('open');
    this._pauseMenu.setAttribute('aria-hidden', 'false');
  }

  _resume() {
    this._onResume();
    this._closePauseMenu();
  }

  _closePauseMenu() {
    this._paused = false;
    this._updatePauseIcon(false);
    this._pauseMenu.classList.remove('open');
    this._pauseMenu.setAttribute('aria-hidden', 'true');
  }

  _setMuted(muted) {
    this._muted = muted;
    this._muteBtn.dataset.muted = String(muted);
  }

  _updatePauseIcon(isPaused) {
    const icon = document.getElementById('pause-icon');
    if (isPaused) {
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5v14l11-7z"/>
      </svg>`;
    } else {
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="5"  y="3" width="4" height="18" rx="1"/>
        <rect x="15" y="3" width="4" height="18" rx="1"/>
      </svg>`;
    }
  }

  _updateSliderFill(value) {
    if (this._activeFill) {
      const rightClip = (100 - value) + '%';
      this._activeFill.style.clipPath = `inset(0 ${rightClip} 0 0)`;
    }
  }
}

/* =============================================================================
   MODULE: GameEngine
   Orchestrates the narrative flow between VideoPlayer, ChoiceUI, OverlayUI.
   ============================================================================= */
class GameEngine {
  constructor(storyGraph, player, choiceUI, overlayUI) {
    this._story       = storyGraph;
    this._player      = player;
    this._choiceUI    = choiceUI;
    this._overlayUI   = overlayUI;
    this._currentNode = null;
    this._pauseMenu   = null;
  }

  /** Late-inject the PauseMenu to break the circular dependency. */
  setPauseMenu(pauseMenu) {
    this._pauseMenu = pauseMenu;
  }

  /**
   * Navigate to a named story node.
   * @param {string} nodeId
   */
  navigateTo(nodeId) {
    const node = this._story[nodeId];
    if (!node) { console.error(`[GameEngine] Node not found: "${nodeId}"`); return; }

    this._currentNode = null;
    this._choiceUI.hide();
    this._overlayUI.hide();

    // 'win' nodes with no video show the overlay immediately.
    // FIX: use pauseAtEnd() instead of stop() to keep the last frame visible.
    if (node.type === 'win' && !node.video) {
      this._player.pauseAtEnd();
      this._overlayUI.show(node);
      this._pauseMenu?.hide();
      return;
    }

    // Show pause button as soon as gameplay starts.
    this._pauseMenu?.show();

    this._currentNode = node;
    this._player.load(node.video);
  }

  /**
   * Called by VideoPlayer when the current video reaches its end.
   * Dispatches to the appropriate handler based on node type.
   */
  handleVideoEnded() {
    if (!this._currentNode) return;

    const handlers = {
      // FIX: pause on last frame before showing buttons
      choices: (node) => {
        this._player.pauseAtEnd();
        this._choiceUI.show(node);
      },
      autoNext: (node) => {
        setTimeout(() => this.navigateTo(node.next), 200);
      },
      // FIX: pause on last frame before showing death overlay
      death: (node) => {
        this._player.pauseAtEnd();
        this._overlayUI.show(node);
        this._pauseMenu?.hide();
      },
      // FIX: pause on last frame before showing win overlay
      win: (node) => {
        const resultNodeId = node.resultNode || 'continuara';
        const resultNode   = this._story[resultNodeId];
        if (resultNode) {
          this._player.pauseAtEnd();
          this._overlayUI.show(resultNode);
          this._pauseMenu?.hide();
        }
      },
    };

    const handler = handlers[this._currentNode.type];
    if (handler) handler(this._currentNode);
    else console.warn(`[GameEngine] No handler for type: "${this._currentNode.type}"`);
  }

  handleKeyPress(key) {
    if (this._pauseMenu?.isPaused) return;
    if (this._currentNode?.type === 'choices') {
      this._choiceUI.handleKeyPress(key, this._currentNode);
    }
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
    15_000,
  );

  const overlayUI = new OverlayUI(document.getElementById('overlay'), navigate);

  // HTML5 video player — fires onEnded when a video finishes
  const player = new VideoPlayer('game-video', () => engineRef.handleVideoEnded());

  const engine  = new GameEngine(STORY_GRAPH, player, choiceUI, overlayUI);
  engineRef = engine;

  // Title screen modals
  const titleMenu = new TitleMenu();

  // Pause menu with injected callbacks
  const pauseMenu = new PauseMenu({
    onPause:        () => player.pauseVideo(),
    onResume:       () => player.resume(),
    onHowToPlay:    () => titleMenu.openModal('how'),
    // FIX: back-to-menu is the only place that calls stop() (clears src)
    onMainMenu:     () => {
      player.stop();
      returnToTitleScreen();
    },
    onVolumeChange: (vol) => player.setVolume(vol),
  });

  engine.setPauseMenu(pauseMenu);

  // Keyboard shortcuts delegated to engine
  document.addEventListener('keydown', (e) => engine.handleKeyPress(e.key));

  // Initialise the player (no async API — just wires the DOM element)
  player.init();

  return { engine, player, titleMenu };
}

/** Resets the UI back to the title screen without reloading the page. */
function returnToTitleScreen() {
  const ts = document.getElementById('title-screen');
  ts.classList.remove('hide');
  ts.style.opacity      = '';
  ts.style.pointerEvents = '';
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('choices').classList.remove('show');
}

const { engine, player, titleMenu } = buildApp();

/* =============================================================================
   GLOBAL ENTRY POINTS
   ============================================================================= */

/**
 * Called by the "Jugar" button on the title screen.
 * Exposed globally so the inline onclick and the addEventListener both work.
 */
function startStory() { // eslint-disable-line no-unused-vars
  document.getElementById('title-screen').classList.add('hide');
  setTimeout(() => engine.navigateTo('intro'), 600);
}

document.getElementById('start-btn').addEventListener('click', startStory);