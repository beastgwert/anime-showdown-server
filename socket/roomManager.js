/**
 * Room Manager for Multiplayer Anime Card Game
 * Handles room creation, joining, and management
 */

// In-memory storage for active rooms
const activeRooms = new Map();

/**
 * Generates a random 6-character room code
 * @returns {string} Room code (uppercase alphanumeric)
 */
function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Creates a new game room
 * @param {string} hostSocketId - Socket ID of the host player
 * @returns {Object} Room data including roomId
 */
function createRoom(hostSocketId) {
  // Generate unique room code
  let roomId;
  do {
    roomId = generateRoomCode();
  } while (activeRooms.has(roomId));

  // Create room object
  const room = {
    roomId,
    host: hostSocketId,
    players: [
      { socketId: hostSocketId, isHost: true }
    ],
    gameState: 'waiting', // waiting, playing, finished
    maxPlayers: 2,
    createdAt: Date.now()
  };

  // Store room in memory
  activeRooms.set(roomId, room);
  
  return room;
}

/**
 * Adds a player to an existing room
 * @param {string} roomId - Room code to join
 * @param {string} socketId - Socket ID of joining player
 * @returns {Object|null} Updated room data or null if join failed
 */
function joinRoom(roomId, socketId) {
  // Check if room exists
  if (!activeRooms.has(roomId)) {
    return { error: 'Room not found' };
  }

  const room = activeRooms.get(roomId);
  
  // Check if room is full
  if (room.players.length >= room.maxPlayers) {
    return { error: 'Room is full' };
  }
  
  // Check if player is already in the room
  if (room.players.some(player => player.socketId === socketId)) {
    return { error: 'Already in room' };
  }
  
  // Add player to room
  room.players.push({ socketId, isHost: false });
  activeRooms.set(roomId, room);
  
  return room;
}

/**
 * Removes a player from their current room
 * @param {string} socketId - Socket ID of the player leaving
 * @returns {Object} Room data and player that left
 */
function leaveRoom(socketId) {
  let roomId = null;
  let room = null;
  
  // Find which room the player is in
  for (const [id, r] of activeRooms.entries()) {
    if (r.players.some(player => player.socketId === socketId)) {
      roomId = id;
      room = r;
      break;
    }
  }
  
  if (!room) {
    return { error: 'Not in a room' };
  }
  
  // Remove player from room
  room.players = room.players.filter(player => player.socketId !== socketId);
  
  // If room is empty, delete it
  if (room.players.length === 0) {
    activeRooms.delete(roomId);
    return { roomDeleted: true, roomId };
  }
  
  // If host left, assign new host
  if (socketId === room.host && room.players.length > 0) {
    const newHost = room.players[0].socketId;
    room.host = newHost;
    room.players[0].isHost = true;
  }
  
  // Update room in storage
  activeRooms.set(roomId, room);
  
  return { room, roomId };
}

/**
 * Updates the game state for a room
 * @param {string} roomId - Room ID to update
 * @param {string} gameState - New game state
 * @returns {Object} Updated room data
 */
function updateGameState(roomId, gameState) {
  if (!activeRooms.has(roomId)) {
    return { error: 'Room not found' };
  }
  
  const room = activeRooms.get(roomId);
  room.gameState = gameState;
  activeRooms.set(roomId, room);
  
  return room;
}

/**
 * Gets room data by room ID
 * @param {string} roomId - Room ID to retrieve
 * @returns {Object|null} Room data or null if not found
 */
function getRoomById(roomId) {
  return activeRooms.has(roomId) ? activeRooms.get(roomId) : null;
}

/**
 * Gets room data by player's socket ID
 * @param {string} socketId - Socket ID to find room for
 * @returns {Object|null} Room data or null if not found
 */
function getRoomBySocketId(socketId) {
  for (const [roomId, room] of activeRooms.entries()) {
    if (room.players.some(player => player.socketId === socketId)) {
      return { ...room, roomId };
    }
  }
  return null;
}

/**
 * Cleans up inactive rooms
 * @param {number} maxAgeMs - Maximum age of room in milliseconds
 * @returns {number} Number of rooms cleaned up
 */
function cleanupInactiveRooms(maxAgeMs = 3600000) { // Default 1 hour
  const now = Date.now();
  let count = 0;
  
  for (const [roomId, room] of activeRooms.entries()) {
    if (now - room.createdAt > maxAgeMs) {
      activeRooms.delete(roomId);
      count++;
    }
  }
  
  return count;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  updateGameState,
  getRoomById,
  getRoomBySocketId,
  cleanupInactiveRooms
};
