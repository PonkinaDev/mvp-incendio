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
   Responsibility: Define the complete narrative graph.
   Each node is a plain data object; no executable logic lives here.
   ============================================================================= */

/**
 * @typedef {Object} Choice
 * @property {string} label - Button label shown to the user.
 * @property {string} sub   - Short description shown below the label.
 * @property {string} next  - Key of the node to navigate to.
 */

/**
 * @typedef {Object} OverlayButton
 * @property {string} label - Button label.
 * @property {string} next  - Key of the node to navigate to on click.
 * @property {string} style - Optional CSS class suffix (e.g. "primary").
 */

/**
 * @typedef {Object} StoryNode
 * @property {string}         [video]   - YouTube video ID (absent for win/death-only nodes).
 * @property {string}         type      - "choices" | "autoNext" | "death" | "win".
 * @property {Choice[]}       [choices] - Available choices (type === "choices").
 * @property {string}         [next]    - Auto-advance target (type === "autoNext").
 * @property {string}         [title]   - Result screen title (type === "death" | "win").
 * @property {string}         [desc]    - Result screen description.
 * @property {OverlayButton[]}[btns]    - Result screen action buttons.
 */

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

/**
 * Complete story graph.
 * Keys are node identifiers referenced by `next` properties.
 * @type {Object.<string, StoryNode>}
 */
const STORY_GRAPH = Object.freeze({

  /* ── Entry point ─────────────────────────────────────────── */
  intro: {
    video: VIDEO_IDS.MVP1,
    type: 'choices',
    choices: [
      { label: 'Subir al ascensor',            sub: 'Puede ser más rápido para bajar',  next: 'ascensor'  },
      { label: 'Usar las escaleras',            sub: 'Más seguro, pero hay humo',        next: 'escaleras' },
    ],
  },

  /* ── Route A: elevator → death ───────────────────────────── */
  ascensor: {
    video: VIDEO_IDS.MVP2,
    type: 'death',
    title: 'MORISTE',
    desc: 'Te asfixiaste atrapado en el ascensor. El humo no perdona.',
    btns: [{ label: '↺ Reintentar', next: 'intro', style: '' }],
  },

  /* ── Route B: stairs → three choices ─────────────────────── */
  escaleras: {
    video: VIDEO_IDS.MVP3,
    type: 'choices',
    choices: [
      { label: 'Saltar el fuego',               sub: 'Las llamas parecen cruzables...',       next: 'saltar_fuego' },
      { label: 'Usar el extintor',              sub: 'El extintor está en el corredor',       next: 'ruta_b1'      },
      { label: 'Usar la manguera del gabinete', sub: 'Controlar el fuego antes de avanzar',   next: 'manguera'     },
    ],
  },

  /* B-1: jump fire → death */
  saltar_fuego: {
    video: VIDEO_IDS.MVP8,
    type: 'death',
    title: 'MORISTE',
    desc: 'Las llamas te alcanzaron. El fuego no se puede cruzar.',
    btns: [{ label: '↺ Reintentar desde aquí', next: 'escaleras', style: '' }],
  },

  /* B-2: alternative route → auto-chain MVP5 → MVP9 → MVP6 → exit choice */
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

  /* B-3: fire hose → MVP4 → exit choice */
  manguera: {
    video: VIDEO_IDS.MVP4,
    type: 'choices',
    choices: [
      { label: 'Salida de emergencia', sub: 'El corredor lateral parece despejado', next: 'salida_emerg_manguera' },
      { label: 'Salida principal',     sub: 'Por donde entraste al edificio',       next: 'win_salida'            },
    ],
  },

  /* Emergency exit from hose route → flashover death */
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

  /* ── Victory ─────────────────────────────────────────────── */
  win_salida: {
    type: 'win',
    title: '¡SALISTE!',
    desc: 'Lograste escapar del incendio. Tus decisiones te salvaron la vida.',
    btns: [{ label: '↺ Jugar de nuevo', next: 'intro', style: 'primary' }],
  },
});

/* =============================================================================
   MODULE: YouTubePlayer
   Responsibility: Manage all interaction with the YouTube IFrame API.
   Exposes load() and stop(); notifies the engine via onEnded callback.
   ============================================================================= */

/**
 * @class YouTubePlayer
 * Wraps the YouTube IFrame API player.
 * Consumers interact only through the public interface: load() and stop().
 */
class YouTubePlayer {
  /**
   * @param {string}   containerId - DOM id where the iframe will be injected.
   * @param {Function} onEnded     - Callback invoked when the current video ends.
   */
  constructor(containerId, onEnded) {
    /** @private @type {YT.Player|null} */
    this._player = null;

    /** @private @type {boolean} */
    this._ready = false;

    /** @private @type {string|null} Queued video ID waiting for player readiness. */
    this._pendingVideoId = null;

    /** @private @type {Function} */
    this._onEnded = onEnded;

    /** @private @type {string} */
    this._containerId = containerId;
  }

  /**
   * Initialises the YT.Player instance.
   * Must be called from the global onYouTubeIframeAPIReady() hook.
   */
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

  /**
   * Loads and plays a YouTube video by ID.
   * If the player is not yet ready the request is queued.
   * @param {string} videoId - YouTube video ID.
   */
  load(videoId) {
    if (!this._ready) {
      this._pendingVideoId = videoId;
      return;
    }
    this._player.loadVideoById({ videoId, startSeconds: 0 });
  }

  /**
   * Stops the currently playing video.
   */
  stop() {
    if (this._ready && this._player) {
      this._player.stopVideo();
    }
  }

  /* ── Private helpers ─────────────────────────────────────── */

  /** @private Handles player ready event. */
  _handleReady() {
    this._ready = true;
    if (this._pendingVideoId) {
      this._player.loadVideoById({ videoId: this._pendingVideoId, startSeconds: 0 });
      this._pendingVideoId = null;
    }
  }

  /**
   * @private
   * @param {YT.OnStateChangeEvent} event
   */
  _handleStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
      this._onEnded();
    }
  }
}

/* =============================================================================
   MODULE: ChoiceUI
   Responsibility: Render the decision panel and manage the auto-select timer.
   ============================================================================= */

/**
 * @class ChoiceUI
 * Renders choice buttons and a countdown bar.
 * Invokes onChoose(nextNodeId) when the user picks an option or time runs out.
 */
class ChoiceUI {
  /**
   * @param {Object}   elements
   * @param {Element}  elements.panel      - The sliding panel container.
   * @param {Element}  elements.row        - Container for the choice buttons.
   * @param {Element}  elements.fill       - The countdown bar fill element.
   * @param {Function} onChoose            - Callback invoked with the chosen node id.
   * @param {number}   [autoSelectMs=15000]- Milliseconds before auto-selecting.
   */
  constructor({ panel, row, fill }, onChoose, autoSelectMs = 15000) {
    this._panel        = panel;
    this._row          = row;
    this._fill         = fill;
    this._onChoose     = onChoose;
    this._autoSelectMs = autoSelectMs;

    /** @private @type {number|null} */
    this._timer = null;
  }

  /**
   * Renders choices for the given node and shows the panel.
   * @param {StoryNode} node - Must be of type "choices".
   */
  show(node) {
    this._row.innerHTML = node.choices
      .map(
        (c) => `<button class="choice-btn" data-next="${c.next}">
          ${c.label}${c.sub ? `<small>${c.sub}</small>` : ''}
        </button>`
      )
      .join('');

    // Attach click listeners (avoids inline onclick in markup)
    this._row.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => this._onChoose(btn.dataset.next));
    });

    this._panel.classList.add('show');
    this._startCountdown(node);
  }

  /**
   * Hides the panel and cancels any pending auto-select timer.
   */
  hide() {
    this._panel.classList.remove('show');
    this._stopCountdown();
  }

  /**
   * Handles keyboard shortcut selection (keys "1", "2", "3").
   * @param {string}    key  - Pressed key value.
   * @param {StoryNode} node - Current node with choices array.
   */
  handleKeyPress(key, node) {
    const index = ['1', '2', '3'].indexOf(key);
    if (index !== -1 && node.choices[index]) {
      this._onChoose(node.choices[index].next);
    }
  }

  /* ── Private helpers ─────────────────────────────────────── */

  /** @private Starts the animated countdown bar and the auto-select timer. */
  _startCountdown(node) {
    // Reset animation by forcing a reflow
    this._fill.className = '';
    void this._fill.offsetHeight;
    this._fill.className = 'running';

    this._stopCountdown();
    this._timer = setTimeout(() => {
      const random = node.choices[Math.floor(Math.random() * node.choices.length)];
      this._onChoose(random.next);
    }, this._autoSelectMs);
  }

  /** @private Stops the countdown timer and resets the bar. */
  _stopCountdown() {
    clearTimeout(this._timer);
    this._timer = null;
    this._fill.className = '';
  }
}

/* =============================================================================
   MODULE: OverlayUI
   Responsibility: Render the death / victory result screen.
   ============================================================================= */

/**
 * @class OverlayUI
 * Shows a full-screen result overlay with a title, description and action buttons.
 */
class OverlayUI {
  /**
   * @param {Element}  container - The overlay root element (#overlay).
   * @param {Function} onAction  - Callback invoked with the chosen next node id.
   */
  constructor(container, onAction) {
    this._container = container;
    this._onAction  = onAction;
  }

  /**
   * Populates and displays the overlay for the given node.
   * @param {StoryNode} node - Must be of type "death" or "win".
   */
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

  /**
   * Hides the overlay.
   */
  hide() {
    this._container.style.display = 'none';
  }
}

/* =============================================================================
   MODULE: GameEngine
   Responsibility: Orchestrate narrative flow by wiring the other modules.
   Holds the current state and delegates rendering/playback to its dependencies.
   ============================================================================= */

/**
 * @class GameEngine
 * Central controller that reads STORY_GRAPH and drives the experience.
 * Dependencies are injected to keep the engine decoupled from implementations.
 */
class GameEngine {
  /**
   * @param {Object.<string, StoryNode>} storyGraph - The narrative data.
   * @param {YouTubePlayer}              player     - Video playback module.
   * @param {ChoiceUI}                   choiceUI   - Decision panel module.
   * @param {OverlayUI}                  overlayUI  - Result overlay module.
   */
  constructor(storyGraph, player, choiceUI, overlayUI) {
    this._story     = storyGraph;
    this._player    = player;
    this._choiceUI  = choiceUI;
    this._overlayUI = overlayUI;

    /** @private @type {StoryNode|null} */
    this._currentNode = null;
  }

  /**
   * Transitions to the given scene node.
   * Called at start and whenever a choice is made.
   * @param {string} nodeId - Key of the target node in the story graph.
   */
  navigateTo(nodeId) {
    const node = this._story[nodeId];

    if (!node) {
      console.error(`[GameEngine] Node not found: "${nodeId}"`);
      return;
    }

    this._currentNode = null;
    this._choiceUI.hide();
    this._overlayUI.hide();

    // Nodes without a video (victory) go straight to the overlay
    if (node.type === 'win') {
      this._player.stop();
      this._overlayUI.show(node);
      return;
    }

    this._currentNode = node;
    this._player.load(node.video);
  }

  /**
   * Handles the end of the current video.
   * Invoked by YouTubePlayer via callback.
   */
  handleVideoEnded() {
    if (!this._currentNode) return;

    const handlers = {
      choices:  (node) => this._choiceUI.show(node),
      autoNext: (node) => setTimeout(() => this.navigateTo(node.next), 200),
      death:    (node) => this._overlayUI.show(node),
    };

    const handler = handlers[this._currentNode.type];
    if (handler) {
      handler(this._currentNode);
    } else {
      console.warn(`[GameEngine] No handler for node type: "${this._currentNode.type}"`);
    }
  }

  /**
   * Handles keyboard input for choice selection.
   * Forwards to ChoiceUI only when a choices-type node is active.
   * @param {string} key - The key that was pressed.
   */
  handleKeyPress(key) {
    if (this._currentNode?.type === 'choices') {
      this._choiceUI.handleKeyPress(key, this._currentNode);
    }
  }
}

/* =============================================================================
   BOOTSTRAP
   Wires all modules together and exposes the two global hooks
   required by YouTube IFrame API and the HTML start button.
   ============================================================================= */

/**
 * Builds and wires all application modules.
 * Returns the configured GameEngine instance.
 * @returns {GameEngine}
 */
function buildApp() {
  // --- ChoiceUI & OverlayUI need the engine's navigateTo method,
  //     but the engine doesn't exist yet. We use a forwarder function
  //     to break the circular dependency without coupling the modules.
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

  const overlayUI = new OverlayUI(
    document.getElementById('overlay'),
    navigate
  );

  const player = new YouTubePlayer(
    'yt-player',
    () => engineRef.handleVideoEnded()
  );

  const engine = new GameEngine(STORY_GRAPH, player, choiceUI, overlayUI);
  engineRef = engine;

  // Global keyboard listener — delegated to the engine
  document.addEventListener('keydown', (e) => engine.handleKeyPress(e.key));

  return { engine, player };
}

// Instantiate on script load
const { engine, player } = buildApp();

/* =============================================================================
   GLOBAL HOOKS  (required by external APIs and inline HTML)
   ============================================================================= */

/**
 * Called automatically by the YouTube IFrame API once it is ready.
 * Initialises the YouTube player.
 */
function onYouTubeIframeAPIReady() { // eslint-disable-line no-unused-vars
  player.init();
}

/**
 * Starts the interactive experience.
 * Bound to the "COMENZAR" button in the HTML.
 */
function startStory() { // eslint-disable-line no-unused-vars
  document.getElementById('title-screen').classList.add('hide');
  setTimeout(() => engine.navigateTo('intro'), 600);
}

// Bind start button without inline onclick
document.getElementById('start-btn').addEventListener('click', startStory);