/**
 * Game State Manager for Multiplayer Anime Card Game
 * Handles game state synchronization between players
 */

// Character info for damage calculations
const characterInfo = {
  abilityDamages: {
    'Sung-jin-woo': [160, 200],
    'Mikasa': [80, 120],
    'Luffy': [110, 130],
    'Gojo': [100, 200],
    'Natsu': [120, 130],
    'Ichigo': [0, 10],
    'Kakashi': [150, 200],
    'Anya': [125, 175],
    'Mudkip': [90, 130],
    'Genos': [200, 210],
    'Makima': [95, 135],
  }
};

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
    gamePhase: 'loadout', // loadout, active, ended
    lastUpdated: Date.now()
  };
  
  // Store game state in memory
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Updates player decks in game state with confirmed loadouts
 * @param {string} roomId - Room ID to update
 * @param {Array} players - Array of players with confirmed decks
 * @returns {Object} Updated game state
 */
function updatePlayerDecks(roomId, players) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Update each player's deck in the game state
  players.forEach(player => {
    const playerIndex = gameState.players.findIndex(p => p.socketId === player.socketId);
    if (playerIndex !== -1) {
      gameState.players[playerIndex].deck = player.deck;
    }
  });
  
  // Update game phase to active
  gameState.gamePhase = 'active';
  gameState.lastUpdated = Date.now();
  
  // Store updated state
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
  
  if (gameState.currentPlayerIndex !== playerIndex) {
    return { error: 'Not your turn' };
  }
  
  // Process different action types
  switch (action.type) {
    case 'attack':
      // Handle attack action
      const { attackingCardIndex, targetCardIndex, specialAbility } = action;
      
      // Validate indices
      if (attackingCardIndex < 0 || attackingCardIndex >= 3 || targetCardIndex < 0 || targetCardIndex >= 3) {
        return { error: 'Invalid card indices' };
      }
      
      // Get attacking card name
      const attackingCard = gameState.players[playerIndex].deck[attackingCardIndex];
      
      // Calculate damage based on character's ability damage range
      const damageRange = characterInfo.abilityDamages[attackingCard];
      if (!damageRange) {
        return { error: 'Invalid attacking card' };
      }
      
      const minDamage = damageRange[0];
      const maxDamage = damageRange[1];
      const damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
      
      // Set attack state in game
      gameState.isAttacking = true;
      gameState.attackingPlayer = playerIndex;
      gameState.attackingCardIndex = attackingCardIndex;
      gameState.targetPlayer = playerIndex === 0 ? 1 : 0;
      gameState.targetCardIndex = targetCardIndex;
      gameState.specialAbility = specialAbility;
      gameState.damageDealt = damage;
      
      console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage`);
      break;
      
    case 'play-card':
      // Logic for playing a card
      // This would be expanded based on game rules
      break;
      
    case 'end-turn':
      // Switch turns to next player
      const nextPlayerIndex = (playerIndex + 1) % gameState.players.length;
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



module.exports = {
  initializeGameState,
  updatePlayerDecks,
  processGameAction,
  getGameState,
  endGame
};
