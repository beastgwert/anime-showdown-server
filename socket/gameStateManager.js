/**
 * Game State Manager for Multiplayer Anime Card Game
 * Handles game state synchronization between players
 */

// Character info for damage calculations and passive abilities
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
  },
  passiveAbilities: {
    'Gojo': {
      type: 'dodge',
      value: 0.15, // 15% dodge chance for all team cards
      description: 'Grants 15% dodge chance to all team cards'
    },
    'Kakashi': {
      type: 'crit',
      value: 0.25, // 25% crit chance for all team cards
      multiplier: 1.5, // 1.5x damage on crit
      description: 'Grants 25% crit chance with 1.5x damage to all team cards'
    },
    'Anya': {
      type: 'damage_reduction',
      value: 0.20, // 20% damage reduction for all team cards
      description: 'Reduces all incoming damage by 20% for all team cards'
    },
    'Makima': {
      type: 'damage_distribution',
      description: 'Distributes incoming damage equally among all alive team cards'
    }
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
      let damage = Math.floor(Math.random() * (maxDamage - minDamage + 1)) + minDamage;
      
      // Check for passive abilities on attacking team
      const attackingTeam = gameState.players[playerIndex].deck;
      let criticalHit = false;
      
      // Check if attacking team has Kakashi (crit passive)
      if (attackingTeam.includes('Kakashi')) {
        const critChance = characterInfo.passiveAbilities['Kakashi'].value;
        if (Math.random() < critChance) {
          criticalHit = true;
          const critMultiplier = characterInfo.passiveAbilities['Kakashi'].multiplier;
          damage = Math.floor(damage * critMultiplier);
          console.log(`Critical hit! Kakashi's passive ability activated (${critChance * 100}% chance, ${critMultiplier}x damage)`);
        }
      }
      
      // Check for passive abilities on defending team
      const targetPlayerIndex = playerIndex === 0 ? 1 : 0;
      const defendingTeam = gameState.players[targetPlayerIndex].deck;
      let attackDodged = false;
      
      // Check if defending team has Gojo (dodge passive)
      if (defendingTeam.includes('Gojo')) {
        const dodgeChance = characterInfo.passiveAbilities['Gojo'].value;
        if (Math.random() < dodgeChance) {
          attackDodged = true;
          damage = 0;
          console.log(`Attack dodged! Gojo's passive ability activated (${dodgeChance * 100}% chance)`);
        }
      }
      
      // Check if defending team has Anya (damage reduction passive)
      // Only apply if attack wasn't dodged
      if (!attackDodged && defendingTeam.includes('Anya')) {
        const damageReduction = characterInfo.passiveAbilities['Anya'].value;
        const originalDamage = damage;
        damage = Math.floor(damage * (1 - damageReduction));
        console.log(`Damage reduced! Anya's passive ability activated (${damageReduction * 100}% reduction: ${originalDamage} → ${damage})`);
      }
      
      // Set attack state in game
      gameState.isAttacking = true;
      gameState.attackingPlayer = playerIndex;
      gameState.attackingCardIndex = attackingCardIndex;
      gameState.targetPlayer = targetPlayerIndex;
      gameState.targetCardIndex = targetCardIndex;
      gameState.specialAbility = specialAbility;
      gameState.damageDealt = damage;
      gameState.attackDodged = attackDodged;
      gameState.criticalHit = criticalHit;
      
      if (attackDodged) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} - ATTACK DODGED!`);
      } else if (criticalHit) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage - CRITICAL HIT!`);
      } else {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage`);
      }
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
 * Marks a player as finished with their action (for turn switching)
 * @param {string} roomId - Room ID
 * @param {string} socketId - Socket ID of player who finished
 * @returns {Object} Result with readyToSwitchTurn flag
 */
function markPlayerActionFinished(roomId, socketId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Initialize actionFinished tracking if not exists
  if (!gameState.actionFinished) {
    gameState.actionFinished = new Set();
  }
  
  // Mark this player as finished
  gameState.actionFinished.add(socketId);
  
  console.log(`Player ${socketId} finished action. Players finished: ${gameState.actionFinished.size}/${gameState.players.length}`);
  
  // Check if all players are ready to switch turns
  const readyToSwitchTurn = gameState.actionFinished.size >= gameState.players.length;
  
  return { readyToSwitchTurn };
}

/**
 * Switches turn to next player and resets action states
 * @param {string} roomId - Room ID
 * @returns {Object} Updated game state
 */
function switchTurn(roomId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Switch to next player
  const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
  gameState.currentPlayerIndex = nextPlayerIndex;
  gameState.turn++;
  
  // Reset attack state
  gameState.isAttacking = false;
  gameState.attackingPlayer = undefined;
  gameState.attackingCardIndex = undefined;
  gameState.targetPlayer = undefined;
  gameState.targetCardIndex = undefined;
  gameState.specialAbility = undefined;
  gameState.damageDealt = undefined;
  gameState.attackDodged = undefined;
  gameState.criticalHit = undefined;
  
  // Clear action finished tracking
  gameState.actionFinished = new Set();
  
  // Update timestamp
  gameState.lastUpdated = Date.now();
  
  // Store updated state
  activeGameStates.set(roomId, gameState);
  
  console.log(`Turn switched to player ${nextPlayerIndex} (turn ${gameState.turn})`);
  
  return gameState;
}

/**
 * Ends a game and cleans up resources
 * @param {string} roomId - Room ID
 * @param {string} loserSocketId - Socket ID of the player who lost (all cards dead)
 * @returns {Object} Result with game state, winner, and loser info
 */
function endGame(roomId, loserSocketId) {
  if (!activeGameStates.has(roomId)) {
    return { error: 'Game state not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Find the loser and winner
  const loserPlayer = gameState.players.find(player => player.socketId === loserSocketId);
  const winnerPlayer = gameState.players.find(player => player.socketId !== loserSocketId);
  
  if (!loserPlayer || !winnerPlayer) {
    return { error: 'Invalid player data' };
  }
  
  // Update game state to ended
  gameState.gamePhase = 'ended';
  gameState.winner = winnerPlayer.socketId;
  gameState.loser = loserPlayer.socketId;
  gameState.lastUpdated = Date.now();
  
  // Keep game state for a short time for clients to process
  // Will be cleaned up by periodic cleanup
  
  console.log(`Game ended for room: ${roomId}. Winner: ${winnerPlayer.socketId}, Loser: ${loserPlayer.socketId}`);
  
  return {
    gameState,
    winner: winnerPlayer.socketId,
    loser: loserPlayer.socketId
  };
}

module.exports = {
  initializeGameState,
  updatePlayerDecks,
  processGameAction,
  getGameState,
  markPlayerActionFinished,
  switchTurn,
  endGame
};
