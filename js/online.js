import { NETWORK_ACTIONS } from './constants.js';

/**
 * Real-Time WebRTC Peer-to-Peer Multiplayer Engine using PeerJS
 * Handles room creation, joining, move sync, disconnection win, and presence checks.
 */
export class OnlineMultiplayerEngine {
  constructor(options = {}) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
    this.myPlayerIndex = 1;
    this.opponentProfile = null;

    this.onStatusChange = options.onStatusChange || (() => {});
    this.onRoomReady = options.onRoomReady || (() => {});
    this.onOpponentJoined = options.onOpponentJoined || (() => {});
    this.onMoveReceived = options.onMoveReceived || (() => {});
    this.onTimeoutReceived = options.onTimeoutReceived || (() => {});
    this.onRestartReceived = options.onRestartReceived || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
    this.onOpponentProfileReceived = options.onOpponentProfileReceived || (() => {});
  }

  generateRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `BOX-${num}`;
  }

  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        resolve(this.peer.id);
        return;
      }

      if (typeof window.Peer === 'undefined') {
        reject(new Error('PeerJS library not loaded. Check your internet connection.'));
        return;
      }

      const peerConfig = {
        debug: 0,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      this.peer = customId ? new window.Peer(customId, peerConfig) : new window.Peer(peerConfig);

      this.peer.on('open', (id) => resolve(id));

      // Host listens for incoming connections
      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.onStatusChange('error', 'Connection error: ' + err.message);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        this.onStatusChange('disconnected', 'Disconnected from signalling server. Reconnecting...');
        // Try to reconnect to PeerJS server
        if (this.peer && !this.peer.destroyed) {
          try { this.peer.reconnect(); } catch (e) {}
        }
      });
    });
  }

  async createRoom(myProfile) {
    this.isHost = true;
    this.myPlayerIndex = 1;
    this.myProfile = myProfile;
    const code = this.generateRoomCode();
    const peerId = `dotsboxes-room-${code.toLowerCase().replace('-', '')}`;

    try {
      this.onStatusChange('creating', 'Setting up room...');
      await this.initPeer(peerId);
    } catch (e) {
      // Fallback with random ID if custom ID fails (already in use)
      await this.initPeer();
    }
    this.roomId = code;
    this.onRoomReady(code);
    this.onStatusChange('waiting', `Waiting for opponent to join...`);
    return code;
  }

  async joinRoom(roomCode, myProfile) {
    this.isHost = false;
    this.myPlayerIndex = 2;
    this.myProfile = myProfile;

    const cleanCode = roomCode.trim().toUpperCase();
    const targetPeerId = `dotsboxes-room-${cleanCode.toLowerCase().replace('-', '')}`;

    this.onStatusChange('connecting', `Connecting to room ${cleanCode}...`);

    try {
      await this.initPeer();
    } catch (e) {
      this.onStatusChange('error', 'Failed to initialize. Check internet connection.');
      return;
    }

    this.conn = this.peer.connect(targetPeerId, { reliable: true });
    this.setupConnectionHandlers();
    this.roomId = cleanCode;
  }

  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.onStatusChange('connected', 'Connected!');
      // Send our profile immediately on connection open
      this.sendAction(NETWORK_ACTIONS.JOIN_ROOM, { profile: this.myProfile });

      this.onOpponentJoined({
        isHost: this.isHost,
        playerIndex: this.myPlayerIndex,
        opponentIndex: this.myPlayerIndex === 1 ? 2 : 1
      });
    });

    this.conn.on('data', (packet) => {
      if (!packet || !packet.action) return;

      switch (packet.action) {
        case NETWORK_ACTIONS.JOIN_ROOM:
          if (packet.payload && packet.payload.profile) {
            this.opponentProfile = packet.payload.profile;
            this.onOpponentProfileReceived(packet.payload.profile);
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

    this.conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.onStatusChange('error', 'Connection lost.');
      this.onDisconnected();
    });
  }

  sendAction(action, payload = {}) {
    if (this.conn && this.conn.open) {
      this.conn.send({ action, payload, timestamp: Date.now() });
    }
  }

  sendMove(type, row, col) {
    this.sendAction(NETWORK_ACTIONS.MAKE_MOVE, { type, row, col });
  }

  sendTimeout() {
    this.sendAction(NETWORK_ACTIONS.TIMEOUT_SKIP);
  }

  sendRestart() {
    this.sendAction(NETWORK_ACTIONS.RESTART_REQUEST);
  }

  isConnected() {
    return !!(this.conn && this.conn.open);
  }

  disconnect() {
    if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
    if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
    this.roomId = null;
  }
}
