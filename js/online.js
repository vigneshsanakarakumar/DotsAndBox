import { NETWORK_ACTIONS } from './constants.js';

/**
 * Real-Time WebRTC Peer-to-Peer Multiplayer Engine using PeerJS
 *
 * FIXED:
 *  - Host correctly fires onOpponentJoined ONLY when a guest connects (peer.on('connection'))
 *  - Guest fires onOpponentJoined when its own conn.on('open') fires
 *  - Both sides exchange profiles and seat assignments reliably
 *  - Reconnect on signalling server drop
 */
export class OnlineMultiplayerEngine {
  constructor(options = {}) {
    this.peer      = null;
    this.conn      = null;
    this.isHost    = false;
    this.roomId    = null;
    this.myProfile = null;
    this.myPlayerIndex = 1;

    this.onStatusChange          = options.onStatusChange          || (() => {});
    this.onRoomReady             = options.onRoomReady             || (() => {});
    this.onOpponentJoined        = options.onOpponentJoined        || (() => {});
    this.onMoveReceived          = options.onMoveReceived          || (() => {});
    this.onTimeoutReceived       = options.onTimeoutReceived       || (() => {});
    this.onRestartReceived       = options.onRestartReceived       || (() => {});
    this.onDisconnected          = options.onDisconnected          || (() => {});
    this.onOpponentProfileReceived = options.onOpponentProfileReceived || (() => {});
  }

  /* ── Peer initialisation ─────────────────────────────────────────────── */
  _initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (typeof window.Peer === 'undefined') {
        reject(new Error('PeerJS not loaded. Check your internet connection.'));
        return;
      }

      const cfg = {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      this.peer = customId
        ? new window.Peer(customId, cfg)
        : new window.Peer(cfg);

      this.peer.on('open', id => resolve(id));

      this.peer.on('error', err => {
        console.error('[PeerJS] Error:', err.type, err.message);
        const msg = err.type === 'unavailable-id'
          ? 'Room code already in use. Try creating again.'
          : 'Connection error: ' + (err.message || err.type);
        this.onStatusChange('error', msg);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        this.onStatusChange('disconnected', 'Reconnecting to server…');
        if (this.peer && !this.peer.destroyed) {
          try { this.peer.reconnect(); } catch (_) {}
        }
      });
    });
  }

  /* ── Host: Create a room ─────────────────────────────────────────────── */
  async createRoom(myProfile) {
    this.isHost        = true;
    this.myPlayerIndex = 1;           // host is always P1
    this.myProfile     = myProfile;

    const code   = `BOX-${Math.floor(1000 + Math.random() * 9000)}`;
    const peerId = `dab-${code.replace('-', '').toLowerCase()}`;   // e.g. dab-box1234

    this.onStatusChange('creating', 'Setting up room…');

    try {
      await this._initPeer(peerId);
    } catch (e) {
      if (e.type === 'unavailable-id') {
        // ID collision — use random peer id and display room code separately
        await this._initPeer();
      } else {
        throw e;
      }
    }

    this.roomId = code;
    this.onRoomReady(code);
    this.onStatusChange('waiting', 'Waiting for opponent to join…');

    // HOST: listen for incoming connection from guest
    this.peer.on('connection', conn => {
      this.conn = conn;
      this._setupHandlers(false /* isGuest */);
    });

    return code;
  }

  /* ── Guest: Join a room ──────────────────────────────────────────────── */
  async joinRoom(roomCode, myProfile) {
    this.isHost        = false;
    this.myPlayerIndex = 2;           // guest is always P2
    this.myProfile     = myProfile;

    const code     = roomCode.trim().toUpperCase();
    const targetId = `dab-${code.replace('-', '').toLowerCase()}`;

    this.onStatusChange('connecting', `Connecting to ${code}…`);

    try {
      await this._initPeer();       // guest uses random peer id
    } catch (e) {
      this.onStatusChange('error', 'Could not initialise. Check your connection.');
      return;
    }

    this.conn   = this.peer.connect(targetId, { reliable: true, serialization: 'json' });
    this.roomId = code;
    this._setupHandlers(true /* isGuest */);
  }

  /* ── Connection event handlers ───────────────────────────────────────── */
  _setupHandlers(isGuest) {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.onStatusChange('connected', 'Connected!');

      // Both sides send their profile immediately
      this._send(NETWORK_ACTIONS.JOIN_ROOM, {
        profile:     this.myProfile,
        playerIndex: this.myPlayerIndex   // 1 = host, 2 = guest
      });

      // GUEST fires onOpponentJoined here (host already knows it's P1)
      if (isGuest) {
        this.onOpponentJoined({ playerIndex: 2, opponentIndex: 1 });
      }
    });

    this.conn.on('data', packet => {
      if (!packet || !packet.action) return;

      switch (packet.action) {
        case NETWORK_ACTIONS.JOIN_ROOM:
          // Receive opponent profile + seat
          if (packet.payload?.profile) {
            this.onOpponentProfileReceived(packet.payload.profile);
          }
          // HOST fires onOpponentJoined when it receives the JOIN_ROOM packet from guest
          if (!isGuest) {
            this.onOpponentJoined({ playerIndex: 1, opponentIndex: 2 });
          }
          break;

        case NETWORK_ACTIONS.MAKE_MOVE:
          this.onMoveReceived(packet.payload);
          break;

        case NETWORK_ACTIONS.TIMEOUT_SKIP:
          this.onTimeoutReceived();
          break;

        case NETWORK_ACTIONS.RESTART_REQUEST:
          this.onRestartReceived();
          break;

        default:
          break;
      }
    });

    this.conn.on('close', () => {
      this.onStatusChange('closed', 'Opponent left the game.');
      this.onDisconnected();
    });

    this.conn.on('error', err => {
      console.error('[Conn] Error:', err);
      this.onStatusChange('error', 'Connection lost.');
      this.onDisconnected();
    });
  }

  /* ── Send helpers ────────────────────────────────────────────────────── */
  _send(action, payload = {}) {
    if (this.conn?.open) {
      this.conn.send({ action, payload, ts: Date.now() });
    }
  }

  sendMove(type, row, col) { this._send(NETWORK_ACTIONS.MAKE_MOVE, { type, row, col }); }
  sendTimeout()            { this._send(NETWORK_ACTIONS.TIMEOUT_SKIP); }
  sendRestart()            { this._send(NETWORK_ACTIONS.RESTART_REQUEST); }

  isConnected() { return !!(this.conn?.open); }

  disconnect() {
    try { this.conn?.close();    } catch (_) {}
    try { this.peer?.destroy();  } catch (_) {}
    this.conn = null; this.peer = null; this.roomId = null;
  }
}
