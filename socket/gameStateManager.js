/**
 * Game State Manager for Multiplayer Anime Card Game
 * Handles game state synchronization between players
 */

// In-memory storage for active game states
const activeGameStates = new Map();

/**
 * Initializes a new game state for a room
 * @param {string} roomId - Room ID to create game state for
 * @param {Array} players - Array of player socket IDs
 * @returns {Object} Initial game state
 */
function initializeGameState(roomId, players) {
  // Create initial game state
  const gameState = {
    roomId,
    players: players.map(player => ({
      socketId: player.socketId,
      deck: player.deck
    })),
    turn: 0,
    currentPlayerIndex: 0, // Host starts
    gamePhase: 'active', // setup, active, ended
    lastUpdated: Date.now()
  };
  
  // Store game state in memory
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Updates game state based on player action
 * @param {string} roomId - Room ID
 * @param {string} socketId - Socket ID of player making the action
 * @param {Object} action - Action data
 * @returns {Object} Updated game state
 */
function processGameAction(roomId, socketId, action) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Verify it's the player's turn
  const playerIndex = gameState.players.findIndex(p => p.socketId === socketId);
  if (playerIndex === -1) {
    return { error: 'Player not in game' };
  }
  
  if (!gameState.players[playerIndex].isCurrentTurn) {
    return { error: 'Not your turn' };
  }
  
  // Process different action types
  switch (action.type) {
    case 'play-card':
      // Logic for playing a card
      // This would be expanded based on game rules
      break;
      
    case 'end-turn':
      // Switch turns to next player
      const nextPlayerIndex = (playerIndex + 1) % gameState.players.length;
      gameState.players[playerIndex].isCurrentTurn = false;
      gameState.players[nextPlayerIndex].isCurrentTurn = true;
      gameState.currentPlayerIndex = nextPlayerIndex;
      gameState.turn++;
      break;
      
    // Add more action types as needed
      
    default:
      return { error: 'Unknown action type' };
  }
  
  // Update timestamp
  gameState.lastUpdated = Date.now();
  
  // Store updated state
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Gets current game state for a room
 * @param {string} roomId - Room ID
 * @returns {Object|null} Game state or null if not found
 */
function getGameState(roomId) {
  return activeGameStates.has(roomId) ? activeGameStates.get(roomId) : null;
}

/**
 * Ends a game and cleans up resources
 * @param {string} roomId - Room ID
 * @returns {boolean} Success status
 */
function endGame(roomId) {
  if (!activeGameStates.has(roomId)) {
    return false;
  }
  
  // Clean up game state
  activeGameStates.delete(roomId);
  return true;
}

/**
 * Gets a filtered view of game state for a specific player
 * Hides information that shouldn't be visible to this player
 * @param {string} roomId - Room ID
 * @param {string} socketId - Socket ID of the player
 * @returns {Object} Filtered game state
 */
function getPlayerView(roomId, socketId) {
  const gameState = getGameState(roomId);
  
  if (!gameState) {
    return null;
  }
  
  // Create a deep copy to avoid modifying the original
  const playerView = JSON.parse(JSON.stringify(gameState));
  
  // Hide other players' hands
  playerView.players.forEach(player => {
    if (player.socketId !== socketId) {
      player.hand = player.hand.map(() => ({ hidden: true }));
    }
  });
  
  return playerView;
}

module.exports = {
  initializeGameState,
  processGameAction,
  getGameState,
  getPlayerView,
  endGame
};
