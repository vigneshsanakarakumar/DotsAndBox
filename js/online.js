import { NETWORK_ACTIONS } from './constants.js';

/**
 * Real-Time WebRTC Peer-to-Peer Multiplayer Engine using PeerJS
 * Enables zero-backend room creation, room joining, and bidirectional state sync.
 */
export class OnlineMultiplayerEngine {
  constructor(options = {}) {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomId = null;
    this.myPlayerIndex = 1; // Host is 1 (P1), Joiner is 2 (P2)
    this.opponentProfile = null;

    this.onStatusChange = options.onStatusChange || (() => {});
    this.onRoomReady = options.onRoomReady || (() => {});
    this.onOpponentJoined = options.onOpponentJoined || (() => {});
    this.onMoveReceived = options.onMoveReceived || (() => {});
    this.onTimeoutReceived = options.onTimeoutReceived || (() => {});
    this.onRestartReceived = options.onRestartReceived || (() => {});
    this.onDisconnected = options.onDisconnected || (() => {});
  }

  /**
   * Generates a clean 6-digit room code e.g. "BOX-4821"
   */
  generateRoomCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `BOX-${num}`;
  }

  /**
   * Initializes PeerJS instance
   */
  initPeer(customId = null) {
    return new Promise((resolve, reject) => {
      if (this.peer && !this.peer.destroyed) {
        resolve(this.peer.id);
        return;
      }

      if (typeof window.Peer === 'undefined') {
        reject(new Error('PeerJS library not loaded. Check internet connection.'));
        return;
      }

      const peerConfig = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      this.peer = customId ? new window.Peer(customId, peerConfig) : new window.Peer(peerConfig);

      this.peer.on('open', (id) => {
        resolve(id);
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this.setupConnectionHandlers();
      });

      this.peer.on('error', (err) => {
        console.error('Peer error:', err);
        this.onStatusChange('error', err.message);
        reject(err);
      });

      this.peer.on('disconnected', () => {
        this.onStatusChange('disconnected', 'Disconnected from matchmaking server');
      });
    });
  }

  /**
   * Host creates a new online room
   */
  async createRoom(myProfile) {
    this.isHost = true;
    this.myPlayerIndex = 1; // Host is Player 1
    const code = this.generateRoomCode();
    const peerId = `dotsboxes-${code.toLowerCase()}`;

    try {
      this.onStatusChange('creating', 'Creating room...');
      await this.initPeer(peerId);
      this.roomId = code;
      this.onRoomReady(code);
      this.onStatusChange('waiting', `Room ready! Share code: ${code}`);
      return code;
    } catch (e) {
      // Fallback with auto-generated id
      await this.initPeer();
      this.roomId = code;
      this.onRoomReady(code);
      return code;
    }
  }

  /**
   * Player joins an existing room by code
   */
  async joinRoom(roomCode, myProfile) {
    this.isHost = false;
    this.myPlayerIndex = 2; // Joiner is Player 2
    const cleanCode = roomCode.trim().toUpperCase();
    const targetPeerId = `dotsboxes-${cleanCode.toLowerCase()}`;

    this.onStatusChange('connecting', `Connecting to room ${cleanCode}...`);

    await this.initPeer();
    this.conn = this.peer.connect(targetPeerId, {
      reliable: true,
      metadata: { profile: myProfile }
    });

    this.setupConnectionHandlers();
    this.roomId = cleanCode;
  }

  /**
   * Setup packet listeners on WebRTC data channel
   */
  setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.onStatusChange('connected', 'Connected with opponent!');
      
      // Exchange profile handshake
      if (this.myProfile) {
        this.sendAction(NETWORK_ACTIONS.JOIN_ROOM, { profile: this.myProfile });
      }

      this.onOpponentJoined({
        isHost: this.isHost,
        playerIndex: this.myPlayerIndex,
        opponentIndex: this.myPlayerIndex === 1 ? 2 : 1
      });
    });

    this.conn.on('data', (packet) => {
      if (!packet || !packet.action) return;

      switch (packet.action) {
        case NETWORK_ACTIONS.MAKE_MOVE:
          this.onMoveReceived(packet.payload);
          break;

        case NETWORK_ACTIONS.TIMEOUT_SKIP:
          this.onTimeoutReceived();
          break;

        case NETWORK_ACTIONS.RESTART_REQUEST:
          this.onRestartReceived();
          break;

        case NETWORK_ACTIONS.JOIN_ROOM:
          if (packet.payload && packet.payload.profile) {
            this.opponentProfile = packet.payload.profile;
          }
          break;

        default:
          break;
      }
    });

    this.conn.on('close', () => {
      this.onStatusChange('closed', 'Opponent disconnected');
      this.onDisconnected();
    });

    this.conn.on('error', (err) => {
      console.error('Connection error:', err);
      this.onStatusChange('error', 'Connection error');
    });
  }

  /**
   * Broadcasts action payload to opponent
   */
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

  disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.roomId = null;
  }
}
