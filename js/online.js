import { NETWORK_ACTIONS } from './constants.js';

/**
 * N-Player WebRTC Multiplayer Engine (2–4 players) using PeerJS
 *
 * Architecture — Host-Relay:
 *   • Host (P1) accepts connections from up to 3 guests.
 *   • Each guest connects ONLY to the host.
 *   • When any player makes a move, they send it to the host.
 *   • Host relays the packet to ALL other connected peers.
 *   • This gives a single source of truth without full-mesh complexity.
 *
 * Seat assignment:
 *   Host = seat 1.  Guests join in order: seat 2, seat 3, seat 4.
 */
export class OnlineMultiplayerEngine {
  constructor(options = {}) {
    this.peer           = null;
    this.isHost         = false;
    this.roomId         = null;
    this.myProfile      = null;
    this.myPlayerIndex  = 1;
    this.maxPlayers     = 2;         // set by createRoom / joinRoom caller

    /* host only: Map<peerID, { conn, playerIndex, profile }> */
    this._guests = new Map();
    /* guest only: single connection to host */
    this._hostConn = null;

    this.onStatusChange            = options.onStatusChange            || (() => {});
    this.onRoomReady               = options.onRoomReady               || (() => {});
    this.onPlayerJoined            = options.onPlayerJoined            || (() => {});
    this.onGameStart               = options.onGameStart               || (() => {});  // fires when room is full
    this.onMoveReceived            = options.onMoveReceived            || (() => {});
    this.onTimeoutReceived         = options.onTimeoutReceived         || (() => {});
    this.onRestartReceived         = options.onRestartReceived         || (() => {});
    this.onDisconnected            = options.onDisconnected            || (() => {});
    this.onPlayerListUpdated       = options.onPlayerListUpdated       || (() => {});
  }

  /* ─── PeerJS bootstrap ─────────────────────────────────────────────── */
  _initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (typeof window.Peer === 'undefined') {
        reject(new Error('PeerJS not loaded. Check your connection.'));
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
      this.peer = customId ? new window.Peer(customId, cfg) : new window.Peer(cfg);
      this.peer.on('open', id => resolve(id));
      this.peer.on('error', err => {
        const m = err.type === 'unavailable-id'
          ? 'Room code in use. Try again.'
          : 'Connection error: ' + (err.message || err.type);
        this.onStatusChange('error', m);
        reject(err);
      });
      this.peer.on('disconnected', () => {
        this.onStatusChange('disconnected', 'Reconnecting…');
        if (this.peer && !this.peer.destroyed) {
          try { this.peer.reconnect(); } catch (_) {}
        }
      });
    });
  }

  /* ─── Create room (Host = P1) ──────────────────────────────────────── */
  async createRoom(myProfile, maxPlayers = 2) {
    this.isHost        = true;
    this.myPlayerIndex = 1;
    this.myProfile     = myProfile;
    this.maxPlayers    = maxPlayers;

    const code   = `BOX-${Math.floor(1000 + Math.random() * 9000)}`;
    const peerId = `dab-${code.replace('-', '').toLowerCase()}`;

    this.onStatusChange('creating', 'Setting up room…');
    try {
      await this._initPeer(peerId);
    } catch (e) {
      if (e.type === 'unavailable-id') await this._initPeer();
      else throw e;
    }

    this.roomId = code;
    this.onRoomReady(code, maxPlayers);
    this.onStatusChange('waiting', `Waiting for players… (1/${maxPlayers})`);

    // Accept incoming guest connections
    this.peer.on('connection', conn => {
      this._handleNewGuest(conn);
    });

    return code;
  }

  /* ─── Join room (Guest = P2/3/4) ───────────────────────────────────── */
  async joinRoom(roomCode, myProfile) {
    this.isHost        = false;
    this.myProfile     = myProfile;

    const code     = roomCode.trim().toUpperCase();
    const targetId = `dab-${code.replace('-', '').toLowerCase()}`;

    this.onStatusChange('connecting', `Connecting to ${code}…`);
    try {
      await this._initPeer();
    } catch (e) {
      this.onStatusChange('error', 'Could not initialise. Check connection.');
      return;
    }

    this._hostConn = this.peer.connect(targetId, { reliable: true, serialization: 'json' });
    this.roomId    = code;
    this._setupGuestHandlers(this._hostConn);
  }

  /* ─── HOST: handle a new incoming guest connection ─────────────────── */
  _handleNewGuest(conn) {
    const assignedIdx = this._guests.size + 2;  // P2, P3, P4

    if (assignedIdx > this.maxPlayers) {
      // Room full — reject silently
      conn.on('open', () => {
        this._hostSend(conn, NETWORK_ACTIONS.ROOM_FULL, {});
        setTimeout(() => conn.close(), 500);
      });
      return;
    }

    const entry = { conn, playerIndex: assignedIdx, profile: null };
    this._guests.set(conn.peer, entry);

    conn.on('open', () => {
      // Tell this guest their seat and all current players
      this._hostSend(conn, NETWORK_ACTIONS.SEAT_ASSIGN, {
        playerIndex: assignedIdx,
        maxPlayers:  this.maxPlayers,
        players:     this._buildPlayerList()
      });

      // Notify all others that someone joined
      this._broadcast(NETWORK_ACTIONS.PLAYER_JOINED, {
        playerIndex: assignedIdx,
        players:     this._buildPlayerList()
      }, conn.peer /* exclude the new guest, they already know */);

      const joined = (this._guests.size + 1);   // +1 for host
      this.onStatusChange('waiting', `Players: ${joined}/${this.maxPlayers}`);
      this.onPlayerListUpdated(this._buildPlayerList());

      // If room now full — fire game start for everyone
      if (joined >= this.maxPlayers) {
        const list = this._buildPlayerList();
        this._broadcastAll(NETWORK_ACTIONS.GAME_START, { players: list });
        this.onGameStart({ players: list, myIndex: 1 });
      }
    });

    conn.on('data', packet => {
      if (!packet?.action) return;
      this._handleHostData(conn, packet, entry);
    });

    conn.on('close', () => {
      this._guests.delete(conn.peer);
      this.onStatusChange('player_left', 'A player disconnected.');
      this.onPlayerListUpdated(this._buildPlayerList());
      this.onDisconnected(assignedIdx);
    });

    conn.on('error', () => {
      this._guests.delete(conn.peer);
      this.onDisconnected(assignedIdx);
    });
  }

  /* ─── HOST: process packets from guests, relay to others ───────────── */
  _handleHostData(fromConn, packet, entry) {
    switch (packet.action) {
      case NETWORK_ACTIONS.JOIN_ROOM:
        if (packet.payload?.profile) {
          entry.profile = packet.payload.profile;
          // Send updated player list to everyone
          const list = this._buildPlayerList();
          this._broadcastAll(NETWORK_ACTIONS.PLAYER_LIST_UPDATE, { players: list });
          this.onPlayerListUpdated(list);
        }
        break;

      case NETWORK_ACTIONS.MAKE_MOVE:
        // Relay to all other guests + apply on host board via callback
        this._relay(fromConn.peer, NETWORK_ACTIONS.MAKE_MOVE, packet.payload);
        this.onMoveReceived(packet.payload);
        break;

      case NETWORK_ACTIONS.TIMEOUT_SKIP:
        this._relay(fromConn.peer, NETWORK_ACTIONS.TIMEOUT_SKIP, packet.payload);
        this.onTimeoutReceived(packet.payload?.skippedPlayer);
        break;

      case NETWORK_ACTIONS.RESTART_REQUEST:
        this._broadcastAll(NETWORK_ACTIONS.RESTART_REQUEST, {});
        this.onRestartReceived();
        break;

      default: break;
    }
  }

  /* ─── GUEST: handle packets from host ──────────────────────────────── */
  _setupGuestHandlers(conn) {
    conn.on('open', () => {
      this.onStatusChange('connected', 'Connected to room!');
      // Send our profile to host
      this._guestSend(NETWORK_ACTIONS.JOIN_ROOM, { profile: this.myProfile });
    });

    conn.on('data', packet => {
      if (!packet?.action) return;

      switch (packet.action) {
        case NETWORK_ACTIONS.SEAT_ASSIGN:
          this.myPlayerIndex = packet.payload.playerIndex;
          this.maxPlayers    = packet.payload.maxPlayers;
          this.onStatusChange('waiting',
            `You are Player ${this.myPlayerIndex}. Waiting for more players…`);
          this.onPlayerListUpdated(packet.payload.players || []);
          break;

        case NETWORK_ACTIONS.PLAYER_JOINED:
          this.onPlayerListUpdated(packet.payload.players || []);
          this.onPlayerJoined(packet.payload);
          break;

        case NETWORK_ACTIONS.PLAYER_LIST_UPDATE:
          this.onPlayerListUpdated(packet.payload.players || []);
          break;

        case NETWORK_ACTIONS.GAME_START:
          this.onGameStart({
            players: packet.payload.players,
            myIndex: this.myPlayerIndex
          });
          break;

        case NETWORK_ACTIONS.MAKE_MOVE:
          this.onMoveReceived(packet.payload);
          break;

        case NETWORK_ACTIONS.TIMEOUT_SKIP:
          this.onTimeoutReceived(packet.payload?.skippedPlayer);
          break;

        case NETWORK_ACTIONS.RESTART_REQUEST:
          this.onRestartReceived();
          break;

        case NETWORK_ACTIONS.ROOM_FULL:
          this.onStatusChange('error', 'Room is full. Try a different room code.');
          break;

        default: break;
      }
    });

    conn.on('close', () => {
      this.onStatusChange('closed', 'Disconnected from room.');
      this.onDisconnected(null);
    });

    conn.on('error', () => {
      this.onStatusChange('error', 'Connection lost.');
      this.onDisconnected(null);
    });
  }

  /* ─── Send helpers ──────────────────────────────────────────────────── */
  _hostSend(conn, action, payload) {
    if (conn?.open) conn.send({ action, payload, ts: Date.now() });
  }

  _guestSend(action, payload) {
    if (this._hostConn?.open)
      this._hostConn.send({ action, payload, ts: Date.now() });
  }

  /** Relay to all guests EXCEPT excludePeerId */
  _relay(excludePeerId, action, payload) {
    for (const [pid, entry] of this._guests) {
      if (pid !== excludePeerId) this._hostSend(entry.conn, action, payload);
    }
  }

  /** Broadcast to ALL guests + process locally on host */
  _broadcastAll(action, payload) {
    for (const entry of this._guests.values()) {
      this._hostSend(entry.conn, action, payload);
    }
  }

  /** Broadcast to all guests except one */
  _broadcast(action, payload, excludePeerId) {
    for (const [pid, entry] of this._guests) {
      if (pid !== excludePeerId) this._hostSend(entry.conn, action, payload);
    }
  }

  /* ─── Public send APIs ──────────────────────────────────────────────── */
  sendMove(type, row, col) {
    const payload = { type, row, col };
    if (this.isHost) {
      // Host's own move: broadcast to all guests, and fire local callback
      this._broadcastAll(NETWORK_ACTIONS.MAKE_MOVE, payload);
      // (host's own processMove is called by onLineClick directly)
    } else {
      this._guestSend(NETWORK_ACTIONS.MAKE_MOVE, payload);
    }
  }

  sendTimeout(skippedPlayer) {
    const payload = { skippedPlayer };
    if (this.isHost) {
      this._broadcastAll(NETWORK_ACTIONS.TIMEOUT_SKIP, payload);
    } else {
      this._guestSend(NETWORK_ACTIONS.TIMEOUT_SKIP, payload);
    }
  }

  sendRestart() {
    if (this.isHost) {
      this._broadcastAll(NETWORK_ACTIONS.RESTART_REQUEST, {});
    } else {
      this._guestSend(NETWORK_ACTIONS.RESTART_REQUEST, {});
    }
  }

  /* ─── Player list builder (host) ────────────────────────────────────── */
  _buildPlayerList() {
    const list = [{
      playerIndex: 1,
      profile: this.myProfile,
      connected: true
    }];
    for (const entry of this._guests.values()) {
      list.push({
        playerIndex: entry.playerIndex,
        profile: entry.profile,
        connected: entry.conn?.open ?? false
      });
    }
    return list.sort((a, b) => a.playerIndex - b.playerIndex);
  }

  isConnected() {
    return this.isHost
      ? this._guests.size > 0
      : !!(this._hostConn?.open);
  }

  connectedCount() {
    return this.isHost ? this._guests.size + 1 : 1;
  }

  disconnect() {
    for (const e of this._guests.values()) { try { e.conn.close(); } catch (_) {} }
    this._guests.clear();
    try { this._hostConn?.close(); } catch (_) {}
    try { this.peer?.destroy();    } catch (_) {}
    this._hostConn = null;
    this.peer = null;
    this.roomId = null;
  }
}
