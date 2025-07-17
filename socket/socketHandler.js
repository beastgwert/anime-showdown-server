/**
 * Socket Handler for Multiplayer Anime Card Game
 * Manages socket connections and events
 */

const roomManager = require('./roomManager');
const gameStateManager = require('./gameStateManager');

/**
 * Initializes socket handlers for a socket.io instance
 * @param {Object} io - Socket.io server instance
 */
function initializeSocketHandlers(io) {
  // Set up connection event
  io.on('connection', (socket) => {
    console.log(`New socket connection: ${socket.id}`);
    
    // Room creation
    socket.on('create-room', () => {
      const room = roomManager.createRoom(socket.id);
      
      // Join socket to room
      socket.join(room.roomId);
      
      // Notify client
      socket.emit('room-created', {
        roomId: room.roomId,
        isHost: true,
        playerIndex: 0
      });
      
      console.log(`Room created: ${room.roomId} by ${socket.id}`);
    });
    
    // Room joining
    socket.on('join-room', (data) => {
      const { roomId } = data;
      
      // Validate and join room
      const joinResult = roomManager.joinRoom(roomId, socket.id);
      
      if (joinResult.error) {
        // Send error to client
        socket.emit('room-error', { error: joinResult.error });
        return;
      }
      
      // Join socket to room
      socket.join(roomId);
      
      // Notify client
      socket.emit('room-joined', {
        roomId,
        isHost: false,
        playerIndex: 1
      });
      
      // Notify all players in room
      io.to(roomId).emit('room-updated', {
        roomId,
        players: joinResult.players,
        gameState: joinResult.gameState
      });
      
      // Notify host that guest joined
      io.to(joinResult.host).emit('player-joined', {
        socketId: socket.id
      });
      
      console.log(`Player ${socket.id} joined room ${roomId}`);
    });
    
    // Start game
    socket.on('start-game', () => {
      // Get room for this socket
      const roomData = roomManager.getRoomBySocketId(socket.id);
      
      if (!roomData) {
        socket.emit('room-error', { error: 'Not in a room' });
        return;
      }
      
      // Verify sender is host
      if (roomData.host !== socket.id) {
        socket.emit('room-error', { error: 'Only host can start game' });
        return;
      }
      
      // Check if room has enough players
      if (roomData.players.length < 2) {
        socket.emit('room-error', { error: 'Need at least 2 players' });
        return;
      }
      
      // Update room state to loadout selection phase
      const updatedRoom = roomManager.updateGameState(roomData.roomId, 'loadout');
      
      // Initialize game state
      const gameState = gameStateManager.initializeGameState(roomData.roomId, updatedRoom.players);
      
      // Notify all players
      io.to(roomData.roomId).emit('game-started', {
        roomId: roomData.roomId,
        gameState: gameState
      });
      
      console.log(`Game started in room ${roomData.roomId}`);
    });
    
    // Confirm loadout
    socket.on('confirm-loadout', (data) => {
      const { loadout } = data;
      
      // Get room for this socket
      const roomData = roomManager.getRoomBySocketId(socket.id);
      
      if (!roomData) {
        socket.emit('room-error', { error: 'Not in a room' });
        return;
      }
      
      // Find player index in the room
      const playerIndex = roomData.players.findIndex(player => player.socketId === socket.id);
      
      if (playerIndex === -1) {
        socket.emit('room-error', { error: 'Player not found in room' });
        return;
      }
      
      // Update player's deck with the confirmed loadout
      const updatedRoom = roomManager.updatePlayerDeck(roomData.roomId, socket.id, loadout);
      
      // Check if all players have confirmed their loadouts
      const allConfirmed = updatedRoom.players.every(player => player.loadoutConfirmed);
      
      if (allConfirmed) {
        // Update room state to playing
        const playingRoom = roomManager.updateGameState(roomData.roomId, 'playing');
        
        // Update game state with confirmed decks
        const updatedGameState = gameStateManager.updatePlayerDecks(roomData.roomId, playingRoom.players);
        
        // Notify all players that the playing phase has started
        io.to(roomData.roomId).emit('playing-started', updatedGameState);
        
        console.log(`Playing started in room ${roomData.roomId}`);
      }
      
      console.log(`Player ${socket.id} confirmed loadout in room ${roomData.roomId}`);
    });
    
    // Leave room
    socket.on('leave-room', () => {
      const result = roomManager.leaveRoom(socket.id);
      
      if (result.error) {
        return;
      }
      
      // Leave socket room
      if (result.roomId) {
        socket.leave(result.roomId);
      }
      
      // Client already handles state cleanup locally
      
      // If room still exists, notify remaining players
      if (!result.roomDeleted && result.room) {
        io.to(result.roomId).emit('player-left', {
          socketId: socket.id,
          room: result.room
        });
      }
      
      console.log(`Player ${socket.id} left room ${result.roomId}`);
    });
    
    // Game action
    socket.on('game-action', (data) => {
      const { action } = data;
      
      // Get room for this socket
      const roomData = roomManager.getRoomBySocketId(socket.id);
      
      if (!roomData) {
        socket.emit('room-error', { error: 'Not in a room' });
        return;
      }
      
      // Process game action
      const updatedState = gameStateManager.processGameAction(
        roomData.roomId,
        socket.id,
        action
      );
      
      if (updatedState.error) {
        socket.emit('game-error', { error: updatedState.error });
        return;
      }
      

      io.to(roomData.roomId).emit('game-state-update', updatedState);
      
      if (action.type === 'special_ability') {
        const switchedState = gameStateManager.switchTurn(roomData.roomId);

        if (switchedState.error) {
          socket.emit('game-error', { error: switchedState.error });
          return;
        }
        io.to(roomData.roomId).emit('switch-turn', switchedState);
      }
    });
    
    // Game action finished (for turn switching)
    socket.on('game-action-finished', (data) => {
      // Get room for this socket
      const roomData = roomManager.getRoomBySocketId(socket.id);
      
      if (!roomData) {
        socket.emit('room-error', { error: 'Not in a room' });
        return;
      }
      
      // Mark this player as ready for turn switch
      const result = gameStateManager.markPlayerActionFinished(
        roomData.roomId,
        socket.id
      );
      
      if (result.error) {
        socket.emit('game-error', { error: result.error });
        return;
      }
      
      // If both players are ready, check for paralysis before switching turns
      if (result.readyToSwitchTurn) {
        // Get current game state to check for paralysis
        const currentState = gameStateManager.getGameState(roomData.roomId);
        
        if (currentState && currentState.enemyParalyzed) {
          // Enemy is paralyzed - don't switch turns, just reset attack state and let same player attack again
          const resetState = gameStateManager.resetAttackState(roomData.roomId);
          
          if (resetState.error) {
            socket.emit('game-error', { error: resetState.error });
            return;
          }
          
          // Broadcast paralysis state (no turn switch)
          io.to(roomData.roomId).emit('paralysis-skip-turn', resetState);
        } else {
          // Normal turn switch
          const updatedState = gameStateManager.switchTurn(roomData.roomId);
          
          if (updatedState.error) {
            socket.emit('game-error', { error: updatedState.error });
            return;
          }
          
          // Broadcast turn switch to all players in the room
          io.to(roomData.roomId).emit('switch-turn', updatedState);
        }
      }
    });
    
    // Game end handling
    socket.on('game-end', (data) => {
      // Get room for this socket
      const roomData = roomManager.getRoomBySocketId(socket.id);
      
      if (!roomData) {
        socket.emit('room-error', { error: 'Not in a room' });
        return;
      }
      
      console.log(`Game end requested by ${socket.id} in room ${roomData.roomId}`);
      
      // End the game and update game state
      const result = gameStateManager.endGame(roomData.roomId, socket.id);
      
      if (result.error) {
        socket.emit('game-error', { error: result.error });
        return;
      }
      
      // Broadcast game end to all players in the room
      io.to(roomData.roomId).emit('end-game', {
        gameState: result.gameState,
        winner: result.winner,
        loser: result.loser
      });
      
      console.log(`Game ended in room ${roomData.roomId}. Winner: ${result.winner}, Loser: ${result.loser}`);
    });
    
    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Handle player leaving room on disconnect
      const result = roomManager.leaveRoom(socket.id);
      
      // If room still exists, notify remaining players
      if (!result.error && !result.roomDeleted && result.room) {
        io.to(result.roomId).emit('player-left', {
          socketId: socket.id,
          room: result.room
        });
      }
    });
  });
  
  // Set up periodic cleanup of inactive rooms
  setInterval(() => {
    const cleanedCount = roomManager.cleanupInactiveRooms();
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive rooms`);
    }
  }, 3600000); // Every hour
}

module.exports = {
  initializeSocketHandlers
};
