const characterInfo = require('../data/characterInfo');
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
      deck: player.deck,
      hp: player.deck.map(cardName => characterInfo.maxHP[cardName] || 1000)
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
      gameState.players[playerIndex].hp = player.deck.map(cardName => characterInfo.maxHP[cardName] || 1000);
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
      const { attackingCardIndex, targetCardIndex, specialAbility: isSpecialAttack } = action;
      
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
      gameState.specialAbility = isSpecialAttack;
      gameState.damageDealt = damage;
      gameState.attackDodged = attackDodged;
      gameState.criticalHit = criticalHit;
      
      // Apply damage to HP if not dodged
      if (!attackDodged && damage > 0) {
        // Check if defending team has Makima (damage distribution)
        if (defendingTeam.includes('Makima')) {
          // Distribute damage among all alive cards
          const aliveCardIndices = [];
          for (let i = 0; i < gameState.players[targetPlayerIndex].hp.length; i++) {
            if (gameState.players[targetPlayerIndex].hp[i] > 0) {
              aliveCardIndices.push(i);
            }
          }
          
          if (aliveCardIndices.length > 0) {
            const distributedDamage = Math.floor(damage / aliveCardIndices.length);
            const remainderDamage = damage % aliveCardIndices.length;
            
            aliveCardIndices.forEach((cardIndex, i) => {
              const damageToApply = distributedDamage + (i < remainderDamage ? 1 : 0);
              gameState.players[targetPlayerIndex].hp[cardIndex] = Math.max(0, gameState.players[targetPlayerIndex].hp[cardIndex] - damageToApply);
            });
            
            console.log(`Makima's damage distribution: ${damage} damage distributed among ${aliveCardIndices.length} alive cards`);
          }
        } else {
          // Apply damage to single target
          gameState.players[targetPlayerIndex].hp[targetCardIndex] = Math.max(0, gameState.players[targetPlayerIndex].hp[targetCardIndex] - damage);
        }
      }
      
      if (attackDodged) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} - ATTACK DODGED!`);
      } else if (criticalHit) {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage - CRITICAL HIT!`);
      } else {
        console.log(`Player ${playerIndex} attacks with ${attackingCard} (card ${attackingCardIndex}) targeting opponent's card ${targetCardIndex} for ${damage} damage`);
      }
      break;
      
    case 'special_ability':
      const { attackingCardIndex: abilityCardIndex } = action;
      
      if (abilityCardIndex < 0 || abilityCardIndex >= 3) {
        return { error: 'Invalid card index' };
      }
      
      const abilityCard = gameState.players[playerIndex].deck[abilityCardIndex];
      const abilityData = characterInfo.specialAbilities[abilityCard];
      if (!abilityData) {
        return { error: 'Character has no special ability' };
      }
      
      switch (abilityData.type) {
        case 'heal_all':
          const healAmount = abilityData.value;
          
          // Apply healing to all alive cards on the player's team
          for (let i = 0; i < gameState.players[playerIndex].hp.length; i++) {
            if (gameState.players[playerIndex].hp[i] > 0) {
              const maxHP = characterInfo.maxHP[gameState.players[playerIndex].deck[i]];
              const healValue = Math.floor(maxHP * healAmount);
              const newHP = Math.min(gameState.players[playerIndex].hp[i] + healValue, maxHP);
              
              console.log(`Card ${i} (${gameState.players[playerIndex].deck[i]}) healed from ${gameState.players[playerIndex].hp[i]} to ${newHP} (+${healValue} HP, ${healAmount * 100}% of ${maxHP} max HP)`);
              gameState.players[playerIndex].hp[i] = newHP;
            }
          }
          
          gameState.isSpecialAbility = true;
          gameState.specialAbilityUser = playerIndex;
          gameState.specialAbilityCard = abilityCardIndex;
          gameState.specialAbilityType = 'heal_all';
          gameState.healAmount = healAmount;
          
          console.log(`Player ${playerIndex} uses ${abilityCard}'s special ability: Shadow Regeneration (heals all allies by ${healAmount * 100}% max HP)`);
          break;
          
        default:
          return { error: 'Unknown special ability type' };
      }
      break;
      
    default:
      return { error: 'Unknown action type' };
  }
  
  // Check for game end conditions after HP modifications
  const gameEndResult = checkGameEndConditions(roomId);
  if (gameEndResult.gameEnded) {
    return gameEndResult.gameState;
  }
  
  gameState.lastUpdated = Date.now();
  activeGameStates.set(roomId, gameState);
  
  return gameState;
}

/**
 * Checks if game should end based on HP conditions
 * @param {string} roomId - Room ID
 * @returns {Object} Result with gameEnded flag and gameState if ended
 */
function checkGameEndConditions(roomId) {
  if (!activeGameStates.has(roomId)) {
    return { gameEnded: false, error: 'Game not found' };
  }
  
  const gameState = activeGameStates.get(roomId);
  
  // Check each player's HP to see if all cards are dead
  for (let playerIndex = 0; playerIndex < gameState.players.length; playerIndex++) {
    const playerHP = gameState.players[playerIndex].hp;
    const allCardsDead = playerHP.every(hp => hp <= 0);
    
    if (allCardsDead) {
      // Game ends - this player loses
      const loserIndex = playerIndex;
      const winnerIndex = playerIndex === 0 ? 1 : 0;
      
      gameState.gamePhase = 'ended';
      gameState.winner = gameState.players[winnerIndex].socketId;
      gameState.loser = gameState.players[loserIndex].socketId;
      gameState.lastUpdated = Date.now();
      
      activeGameStates.set(roomId, gameState);
      
      console.log(`Game ended in room ${roomId}. Winner: ${gameState.winner}, Loser: ${gameState.loser}`);
      
      return { gameEnded: true, gameState };
    }
  }
  
  return { gameEnded: false };
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
  
  // Reset special ability state
  gameState.isSpecialAbility = false;
  gameState.specialAbilityUser = undefined;
  gameState.specialAbilityCard = undefined;
  gameState.specialAbilityType = undefined;
  gameState.healAmount = undefined;
  
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
  checkGameEndConditions,
  markPlayerActionFinished,
  switchTurn,
  endGame
};
